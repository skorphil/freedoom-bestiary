import type { GitReader, TreeEntry } from "./GitReader.ts";
import type { AuthorResolver, SpritePattern, AuthorInfo } from "./types.ts";

/**
 * Options for configuring SnapshotBuilder behavior.
 */
export type SnapshotBuilderOptions = {
  githubBaseUrl: string;
  followSymlinks: boolean;
};

/**
 * Snapshot of all sprites present in one commit from one source repo.
 */
export type CommitSnapshot = {
  commitDate: string;
  commitAuthor: string;
  commitMessage: string;
  commitSha: string;
  commitUrl: string;
  commitIndex: number;
  folder: string | null;
  commitSource: "freedoom" | "attic";
  commitSprites: SpriteFile[];
};

/**
 * Represents a single sprite file in a commit.
 */
export type SpriteFile = {
  code: string;
  filename: string;
  url: string;
  status: FileStatus;
  authorNames: AuthorInfo[];
};

/** Valid file status codes */
export type FileStatus = "A" | "M" | "T" | "R100" | "Existing";

/** Represents a scan unit from CommitLogScanner */
type ScanUnit = {
  sha: string;
  date: string;
  author: string;
  message: string;
  folder: string | null;
  changesMap: Map<string, string>;
};

/**
 * Converts a ScanUnit into a CommitSnapshot via git ls-tree.
 */
export class SnapshotBuilder {
  constructor(
    private reader: GitReader,
    private pattern: SpritePattern,
    private resolver: AuthorResolver,
    private options: SnapshotBuilderOptions,
  ) {}

  /**
   * Builds a CommitSnapshot from a ScanUnit.
   */
  async build(
    unit: ScanUnit,
    source: "freedoom" | "attic",
  ): Promise<CommitSnapshot | null> {
    console.debug("SnapshotBuilder.build: unit=", unit.sha, "folder=", unit.folder, "source=", source);
    
    // 1. Get full tree for the commit SHA
    const entries = await this.reader.getTreeEntries(
      unit.sha,
      unit.folder || undefined,
    );

    // 2. Filter matching sprites and collect URLs for batch resolution
    const candidates: Array<{ entry: TreeEntry; url: string; status: FileStatus }> = [];
    const seenPaths = new Set<string>();

    for (const entry of entries) {
      if (entry.isSymlink || !this.pattern.matches(entry.path)) {
        continue;
      }

      // If grouping is active, ensure the file belongs to this folder's snapshot.
      // Rule: Any path directly in 'sprites/' belongs to 'sprites'.
      // Any path in 'sprites/XYZ/...' belongs to 'sprites/XYZ'.
      if (unit.folder) {
        const pathParts = entry.path.split("/");
        let spriteOwner = "sprites";
        if (pathParts[0] === "sprites" && pathParts.length >= 3) {
          spriteOwner = `sprites/${pathParts[1]}`;
        }
        
        if (spriteOwner !== unit.folder) {
          continue;
        }
      }

      if (seenPaths.has(entry.path)) {
        continue;
      }
      seenPaths.add(entry.path);

      const url = this.buildBlobUrl(unit.sha, entry.path);
      const rawStatus = unit.changesMap.get(entry.path);
      const status = this.normalizeStatus(rawStatus);

      candidates.push({ entry, url, status });
    }

    if (candidates.length === 0) {
      return null;
    }

    // 3. Batch resolve authors using AI/Cache
    const authorMapping = await this.resolver.resolveAuthorsBatch(
      { author: unit.author, message: unit.message, sha: unit.sha },
      candidates.map(c => ({ url: c.url, path: c.entry.path }))
    );

    // 4. Build the final sprite objects
    const spriteFiles: SpriteFile[] = candidates.map(c => ({
      code: this.pattern.code,
      filename: c.entry.path,
      url: c.url,
      status: c.status,
      authorNames: authorMapping[c.url] || [],
    }));

    return {
      commitDate: unit.date,
      commitAuthor: unit.author,
      commitMessage: unit.message,
      commitSha: unit.sha,
      commitUrl: `${this.options.githubBaseUrl}/commit/${unit.sha}`,
      commitIndex: 0, // Will be overridden by BaseParser
      folder: unit.folder,
      commitSource: source,
      commitSprites: spriteFiles,
    };
  }

  private normalizeStatus(rawStatus: string | undefined): FileStatus {
    if (!rawStatus) return "Existing";
    if (rawStatus.startsWith("R")) return "R100";
    switch (rawStatus) {
      case "A": return "A";
      case "M": return "M";
      case "T": return "T";
      default: return "Existing";
    }
  }

  private buildBlobUrl(sha: string, path: string): string {
    return `${this.options.githubBaseUrl}/blob/${sha}/${path}`;
  }
}
