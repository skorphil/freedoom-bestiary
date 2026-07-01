import type { SpritePattern } from "./types.ts";
import type { GitReader } from "./GitReader.ts";

/**
 * Options for configuring the CommitLogScanner behavior.
 */
export type CommitLogScannerOptions = {
  groupByFolder: boolean;
  activeStatuses: string[];
  skippedStatuses: string[];
  spriteCode?: string; // Optional code for context
  extraPaths?: string[]; // Optional extra paths to scan
};

/**
 * Internal raw commit entry before grouping.
 */
type RawCommitEntry = {
  sha: string;
  date: string;
  author: string;
  message: string;
  changesMap: Map<string, string>;
};

/**
 * A unit of work from the commit log scan.
 */
export type ScanUnit = {
  sha: string;
  date: string;
  author: string;
  message: string;
  folder: string | null;
  changesMap: Map<string, string>;
};

/**
 * State-machine line parser for git log output.
 */
export class CommitLogScanner {
  constructor(
    private reader: GitReader,
    private pattern: SpritePattern,
    private options: CommitLogScannerOptions,
  ) {}

  async *scan(): AsyncGenerator<ScanUnit> {
    let current: RawCommitEntry | null = null;
    let inMessage = false;
    let messageBuffer: string[] = [];

    for await (const line of this.reader.streamLog()) {
      if (line.startsWith("COMMIT_START|")) {
        if (current) {
          const units = this.finalize(current);
          for (const unit of units) {
            yield unit;
          }
        }

        const parts = line.split("|");
        const [_, sha, date, author, ...rest] = parts;
        
        current = {
          sha,
          date,
          author,
          message: "",
          changesMap: new Map<string, string>(),
        };
        
        inMessage = true;
        messageBuffer = [];
        
        const initialMessagePart = rest.join("|");
        if (initialMessagePart) {
          if (initialMessagePart.includes("|COMMIT_END")) {
            current.message = initialMessagePart.replace("|COMMIT_END", "").trim();
            inMessage = false;
          } else {
            messageBuffer.push(initialMessagePart);
          }
        }
        continue;
      }

      if (inMessage) {
        if (line.includes("|COMMIT_END")) {
          const lastPart = line.replace("|COMMIT_END", "");
          if (lastPart.trim()) {
            messageBuffer.push(lastPart);
          }
          if (current) {
            current.message = messageBuffer.join("\n").trim();
          }
          inMessage = false;
        } else {
          messageBuffer.push(line);
        }
        continue;
      }

      if (current && line.trim() !== "") {
        this.recordChange(line, current);
      }
    }

    if (current) {
      const units = this.finalize(current);
      for (const unit of units) {
        yield unit;
      }
    }
  }

  private recordChange(line: string, current: RawCommitEntry): void {
    const tabParts = line.split("\t");
    const status = tabParts[0];

    if (status.startsWith("R") || status.startsWith("C")) {
      if (tabParts.length >= 3) {
        const toPath = tabParts[2];
        if (this.pattern.matches(toPath)) {
          current.changesMap.set(toPath, status);
        }
      }
    } else {
      if (tabParts.length >= 2) {
        const path = tabParts[1];
        if (this.pattern.matches(path)) {
          current.changesMap.set(path, status);
        }
      }
    }
  }

  private finalize(commit: RawCommitEntry): ScanUnit[] {
    const filteredChanges = new Map<string, string>();
    for (const [path, status] of commit.changesMap) {
      if (!this.options.skippedStatuses.includes(status)) {
        filteredChanges.set(path, status);
      }
    }

    if (filteredChanges.size === 0) {
      return [];
    }

    if (this.options.activeStatuses.length > 0) {
      const activeChanges = new Map<string, string>();
      for (const [path, status] of filteredChanges) {
        const baseStatus = status.charAt(0);
        if (
          this.options.activeStatuses.includes(status) ||
          this.options.activeStatuses.includes(baseStatus)
        ) {
          activeChanges.set(path, status);
        }
      }

      if (activeChanges.size === 0) {
        return [];
      }

      filteredChanges.clear();
      for (const [path, status] of activeChanges) {
        filteredChanges.set(path, status);
      }
    }

    if (this.options.groupByFolder) {
      const grouped = this.groupByFolder(filteredChanges);
      const units: ScanUnit[] = [];

      for (const [folder, changes] of grouped) {
        units.push({
          sha: commit.sha,
          date: commit.date,
          author: commit.author,
          message: commit.message,
          folder,
          changesMap: changes,
        });
      }

      return units;
    } else {
      return [{
        sha: commit.sha,
        date: commit.date,
        author: commit.author,
        message: commit.message,
        folder: null,
        changesMap: filteredChanges,
      }];
    }
  }

  private groupByFolder(
    changesMap: Map<string, string>,
  ): Map<string, Map<string, string>> {
    const grouped = new Map<string, Map<string, string>>();

    for (const [path, status] of changesMap) {
      const pathParts = path.split("/");
      let folder = "sprites";
      
      if (pathParts[0] === "sprites" && pathParts.length >= 3) {
        // Use full path to subdirectory as key, e.g. "sprites/scubasteve"
        folder = `sprites/${pathParts[1]}`;
      }

      if (!grouped.has(folder)) {
        grouped.set(folder, new Map<string, string>());
      }
      grouped.get(folder)!.set(path, status);
    }

    // Ensure predictable order: root 'sprites' first, then others alphabetically
    const sortedEntries = Array.from(grouped.entries()).sort(([a], [b]) => {
      if (a === "sprites") return -1;
      if (b === "sprites") return 1;
      return a.localeCompare(b);
    });

    return new Map(sortedEntries);
  }
}
