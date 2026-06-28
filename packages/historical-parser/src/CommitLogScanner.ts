import type { SpritePattern } from "./types.ts";
import type { GitReader } from "./GitReader.ts";

/**
 * Options for configuring the CommitLogScanner behavior.
 * Controls how commits are scanned and grouped.
 */
export type CommitLogScannerOptions = {
  /**
   * When true, groups changes by folder (attic-style).
   * When false, creates one unit per commit (freedoom-style).
   */
  groupByFolder: boolean;

  /**
   * Status codes to include in scan results.
   * Freedoom: ["A", "M", "T", "R"]
   * Attic: ["A", "M", "R", "C"]
   */
  activeStatuses: string[];

  /**
   * Status codes to skip/ignore.
   * Both repos: ["D"] (deleted files)
   */
  skippedStatuses: string[];
};

/**
 * Internal raw commit entry before grouping.
 * Represents a commit with its associated file changes.
 */
type RawCommitEntry = {
  /** Commit SHA hash */
  sha: string;
  /** Commit date in ISO format */
  date: string;
  /** Commit author name */
  author: string;
  /** Commit message */
  message: string;
  /** Map of file paths to status codes */
  changesMap: Map<string, string>;
};

/**
 * A unit of work from the commit log scan.
 * For freedoom: one unit per commit.
 * For attic: multiple units per commit (grouped by folder).
 */
export type ScanUnit = {
  /** Commit SHA */
  sha: string;
  /** Commit date (ISO-8601) */
  date: string;
  /** Commit author */
  author: string;
  /** Commit message */
  message: string;
  /** Folder name for attic, null for freedoom */
  folder: string | null;
  /** Map of file paths to status codes */
  changesMap: Map<string, string>;
};

/**
 * State-machine line parser for git log output.
 *
 * Parses `git log --name-status` stream and produces ScanUnits.
 * Handles different grouping strategies for freedoom vs attic.
 *
 * @example
 * const scanner = new CommitLogScanner(reader, pattern, {
 *   groupByFolder: false,
 *   activeStatuses: ["A", "M", "T", "R"],
 *   skippedStatuses: ["D"]
 * });
 * for await (const unit of scanner.scan()) {
 *   console.log(unit.sha, unit.changesMap);
 * }
 */
export class CommitLogScanner {
  /**
   * Creates a new CommitLogScanner.
   *
   * @param reader - GitReader for streaming git log
   * @param pattern - SpritePattern for filtering
   * @param options - Scanner configuration options
   */
  constructor(
    private reader: GitReader,
    private pattern: SpritePattern,
    private options: CommitLogScannerOptions,
  ) {
    // Dependencies are stored via private fields in constructor parameters
  }

  /**
   * Scans the git log and yields ScanUnits.
   *
   * @yields ScanUnits representing commits or commit-folder groups
   */
  async *scan(): AsyncGenerator<ScanUnit> {
    let current: RawCommitEntry | null = null;

    for await (const line of this.reader.streamLog()) {
      // Skip empty lines
      if (line.trim() === "") {
        continue;
      }

      console.debug("CommitLogScanner.scan: got line:", line);

      // Check if this is a commit header line (contains pipe separators)
      if (line.includes("|")) {
        // If we have a previous commit, finalize it
        if (current) {
          const units = this.finalize(current);
          for (const unit of units) {
            yield unit;
          }
        }

        // Start a new commit
        current = this.parseCommitLine(line);
      } else if (current) {
        // This is a file change line for the current commit
        this.recordChange(line, current);
      }
    }

    // Finalize the last commit if exists
    if (current) {
      const units = this.finalize(current);
      for (const unit of units) {
        yield unit;
      }
    }
  }

  /**
   * Parses a commit header line.
   *
   * @param line - Line in format "sha|date|author|message"
   * @returns Parsed commit entry
   */
  private parseCommitLine(line: string): RawCommitEntry {
    const parts = line.split("|");
    if (parts.length < 4) {
      console.error("CommitLogScanner.parseCommitLine: invalid line:", line);
      throw new Error(`Invalid commit line format: ${line}`);
    }
    // Join remaining parts so commit messages containing "|" are preserved
    const [sha, date, author, ...rest] = parts;
    return {
      sha,
      date,
      author,
      message: rest.join("|"),
      changesMap: new Map<string, string>(),
    };
  }

  /**
   * Records a file change line.
   * Handles status lines including renames (R100) and copies (C).
   *
   * @param line - Status line (e.g., "A\tsprites/possa1.png")
   * @param current - Current commit entry being built
   */
  private recordChange(line: string, current: RawCommitEntry): void {
    const tabParts = line.split("\t");
    const status = tabParts[0];

    console.debug("CommitLogScanner.recordChange:", { line, status, tabParts });

    // Handle different status line formats
    if (status.startsWith("R") || status.startsWith("C")) {
      // Rename/Copy: RXXX fromPath toPath or CXXX fromPath toPath
      if (tabParts.length >= 3) {
        const toPath = tabParts[2];
        // Only record the destination path if it matches our pattern
        if (this.pattern.matches(toPath)) {
          current.changesMap.set(toPath, status);
        }
      }
    } else {
      // Simple status: A, M, T, D, etc.
      if (tabParts.length >= 2) {
        const path = tabParts[1];
        // Only record the path if it matches our pattern
        if (this.pattern.matches(path)) {
          current.changesMap.set(path, status);
        }
      }
    }
  }

  /**
   * Finalizes a commit entry into one or more ScanUnits.
   *
   * @param commit - Raw commit entry
   * @returns Array of ScanUnits (1 for freedoom, N for attic)
   */
  private finalize(commit: RawCommitEntry): ScanUnit[] {
    // Filter out skipped statuses
    const filteredChanges = new Map<string, string>();
    for (const [path, status] of commit.changesMap) {
      if (!this.options.skippedStatuses.includes(status)) {
        filteredChanges.set(path, status);
      }
    }

    // If no changes remain after filtering, return empty array
    if (filteredChanges.size === 0) {
      return [];
    }

    // Filter by active statuses if specified
    if (this.options.activeStatuses.length > 0) {
      const activeChanges = new Map<string, string>();
      for (const [path, status] of filteredChanges) {
        // Handle status codes with extra info like R100, C50, etc.
        const baseStatus = status.charAt(0); // Extract base status (R, C, A, M, etc.)
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

    // Group by folder if needed
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
      // Single unit per commit (freedoom-style)
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

  /**
   * Groups file changes by folder path.
   *
   * @param changesMap - Map of file paths to status codes
   * @returns Map of folder names to file change maps
   */
  private groupByFolder(
    changesMap: Map<string, string>,
  ): Map<string, Map<string, string>> {
    const grouped = new Map<string, Map<string, string>>();

    for (const [path, status] of changesMap) {
      // Extract folder from path: sprites/folder/file.png -> folder
      const pathSegments = path.split("/");
      if (pathSegments.length >= 3 && pathSegments[0] === "sprites") {
        const folder = pathSegments[1];
        if (!grouped.has(folder)) {
          grouped.set(folder, new Map<string, string>());
        }
        grouped.get(folder)!.set(path, status);
      } else {
        // Files directly in sprites/ directory go to a default group
        if (!grouped.has("")) {
          grouped.set("", new Map<string, string>());
        }
        grouped.get("")!.set(path, status);
      }
    }

    return grouped;
  }
}
