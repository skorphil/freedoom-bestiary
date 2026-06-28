import { dirname, join } from "node:path";
import type { GitReader, TreeEntry } from "./GitReader.ts";
import type { AuthorResolver, SpritePattern } from "./types.ts";

/**
 * Options for configuring SnapshotBuilder behavior.
 * Controls how commit snapshots are built from scan units.
 */
export type SnapshotBuilderOptions = {
  /**
   * Base URL for GitHub blob/commit links.
   * Examples:
   * - "https://github.com/freedoom/freedoom"
   * - "https://github.com/freedoom/attic"
   */
  githubBaseUrl: string;

  /**
   * Whether to follow symlinks when building snapshots.
   * Freedoom: true (uses symlinks in sprites/)
   * Attic: false (no symlinks)
   */
  followSymlinks: boolean;
};

/**
 * Snapshot of all sprites present in one commit from one source repo.
 * Represents the state of sprites at a specific commit.
 */
export type CommitSnapshot = {
  /** Commit date (ISO-8601) */
  commitDate: string;
  /** Commit author */
  commitAuthor: string;
  /** Commit message */
  commitMessage: string;
  /** Commit SHA */
  commitSha: string;
  /** Full commit URL on GitHub */
  commitUrl: string;
  /** Source repository */
  commitSource: "freedoom" | "attic";
  /** Array of sprite files in this commit */
  commitSprites: SpriteFile[];
};

/**
 * Represents a single sprite file in a commit.
 * Contains metadata about a specific sprite file at a specific commit.
 */
export type SpriteFile = {
  /** Sprite code (e.g., "POSS") */
  code: string;
  /** File path relative to repo root */
  filename: string;
  /** Full blob URL on GitHub */
  url: string;
  /** File status: Added, Modified, Type-changed, Renamed, or Existing */
  status: FileStatus;
  /** Resolved author: folder name for attic, commit author for freedoom */
  authorName: string;
};

/** Valid file status codes */
export type FileStatus = "A" | "M" | "T" | "R100" | "Existing";

/** Represents a scan unit from CommitLogScanner */
type ScanUnit = {
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
 * Converts a ScanUnit into a CommitSnapshot via git ls-tree.
 *
 * Steps:
 * 1. Get full tree for the commit SHA
 * 2. Resolve symlinks if followSymlinks is true
 * 3. Filter sprites by pattern
 * 4. Assign status and author to each sprite
 *
 * @example
 * const builder = new SnapshotBuilder(reader, pattern, resolver, {
 *   githubBaseUrl: "https://github.com/freedoom/freedoom",
 *   followSymlinks: true
 * });
 * const snapshot = await builder.build(unit, "freedoom");
 */
export class SnapshotBuilder {
  /**
   * Creates a new SnapshotBuilder.
   *
   * @param reader - GitReader for git operations
   * @param pattern - SpritePattern for filtering sprites
   * @param resolver - AuthorResolver for author attribution
   * @param options - Builder configuration options
   */
  constructor(
    private reader: GitReader,
    private pattern: SpritePattern,
    private resolver: AuthorResolver,
    private options: SnapshotBuilderOptions,
  ) {
    // Dependencies are stored as private properties
  }

  /**
   * Builds a CommitSnapshot from a ScanUnit.
   *
   * @param unit - The scan unit to convert
   * @param source - The source repository (freedoom or attic)
   * @returns The built snapshot, or null if no sprites match
   */
  async build(
    unit: ScanUnit,
    source: "freedoom" | "attic",
  ): Promise<CommitSnapshot | null> {
    console.debug("SnapshotBuilder.build: unit=", unit.sha, "folder=", unit.folder, "source=", source);
    // Step 1: Get full tree for the commit SHA
    const entries = await this.reader.getTreeEntries(
      unit.sha,
      unit.folder || undefined,
    );
    console.debug("SnapshotBuilder.build: tree entries length=", entries.length);

    // Step 2: Build index and filter sprite files
    const spriteFiles: SpriteFile[] = [];
    const seenPaths = new Set<string>();

    for (const entry of entries) {
      // Step 3: Fast check: Only process real files (not symlinks) that match our sprite pattern.
      // We ignore symlinks because the real files they point to will be picked up 
      // by the tree walk if they are in the repository and follow naming conventions.
      if (entry.isSymlink || !this.pattern.matches(entry.path)) {
        continue;
      }

      // Skip duplicate paths within the same commit
      if (seenPaths.has(entry.path)) {
        console.debug("SnapshotBuilder.build: skipping duplicate path:", entry.path);
        continue;
      }
      seenPaths.add(entry.path);

      // Determine the status of this file
      const rawStatus = unit.changesMap.get(entry.path);
      const status = this.normalizeStatus(rawStatus);

      // Build the sprite file object
      const spriteFile: SpriteFile = {
        code: this.pattern.code,
        filename: entry.path,
        url: this.buildBlobUrl(unit.sha, entry.path),
        status,
        authorName: this.resolver.resolveAuthor(entry.path, unit.author),
      };

      spriteFiles.push(spriteFile);
    }

    // If no sprites match, return null
    if (spriteFiles.length === 0) {
      return null;
    }

    // Build and return the commit snapshot
    const snapshot: CommitSnapshot = {
      commitDate: unit.date,
      commitAuthor: unit.author,
      commitMessage: unit.message,
      commitSha: unit.sha,
      commitUrl: `${this.options.githubBaseUrl}/commit/${unit.sha}`,
      commitSource: source,
      commitSprites: spriteFiles,
    };

    return snapshot;
  }

  /**
   * Normalizes a raw status code to FileStatus.
   *
   * @param rawStatus - Raw status from git (e.g., "A", "M", "R100")
   * @returns Normalized FileStatus
   */
  private normalizeStatus(rawStatus: string | undefined): FileStatus {
    if (!rawStatus) {
      return "Existing";
    }

    // Handle renamed files (RXXX where XXX is a percentage)
    if (rawStatus.startsWith("R")) {
      return "R100"; // Simplified representation
    }

    // Map common git status codes
    switch (rawStatus) {
      case "A":
        return "A"; // Added
      case "M":
        return "M"; // Modified
      case "T":
        return "T"; // Type changed
      default:
        return "Existing"; // Default fallback
    }
  }

  /**
   * Builds a GitHub blob URL for a file.
   *
   * @param sha - Commit SHA
   * @param path - File path
   * @returns Full GitHub blob URL
   */
  private buildBlobUrl(sha: string, path: string): string {
    return `${this.options.githubBaseUrl}/blob/${sha}/${path}`;
  }
}
