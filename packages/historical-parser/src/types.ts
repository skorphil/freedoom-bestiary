/**
 * @module parsers/types
 *
 * Core type definitions and exports for the historical-parser module.
 */

// Export interfaces for use in mocks
export type { CommitLogScannerOptions, ScanUnit } from "./CommitLogScanner.ts";
export type {
  CommitSnapshot,
  FileStatus,
  SnapshotBuilderOptions,
  SpriteFile,
} from "./SnapshotBuilder.ts";

// Export classes
export { SpritePattern } from "./SpritePattern.ts";
export { GitReader } from "./GitReader.ts";
export { CommitLogScanner } from "./CommitLogScanner.ts";
export { SnapshotBuilder } from "./SnapshotBuilder.ts";
export { AtticParser, BaseParser, FreedomParser } from "./BaseParser.ts";
export { VersionCombiner } from "./VersionCombiner.ts";
export { AuthorResolver } from "./AuthorResolver.ts";

// Internal raw types (git output parsing)
/**
 * Represents a raw commit entry from git log output.
 * Used internally for parsing before grouping into ScanUnits.
 */
export type RawCommitEntry = {
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

// Public domain types (pipeline output)
export type SpriteState = "new" | "updated" | "unchanged";
export type CommitSource = "attic" | "freedoom";

/**
 * Author information with relationship context.
 */
export type AuthorInfo = {
  /** The name of the author */
  name: string;
  /** Concise explanation of relation to sprite */
  relation: string;
};

/**
 * Represents a sprite entry in a version snapshot.
 * Contains information about a specific sprite frame.
 */
export type SpriteEntry = {
  /** Frame name/key (e.g., "a1", "b2") */
  name: string;
  /** URL to the sprite image */
  url: string;
  /** Authors who created/modified this sprite */
  spriteAuthors: AuthorInfo[];
  /** State of the sprite (new, updated, unchanged) */
  spriteState: SpriteState;
  /** Date of the commit that last changed this sprite (ISO format) */
  lastChangedDate: string;
  /** The commit index when this sprite was last changed */
  commitIndex: number;
  /** Source repository (freedoom or attic) */
  source?: CommitSource;
};

/**
 * Represents a snapshot of a character's sprite versions at a specific point in time.
 * Created when at least one sprite frame changes.
 */
export type CharacterVersionSnapshot = {
  /** Date of the commit in ISO format */
  commitDate: string;
  /** Commit message */
  commitMessage: string;
  /** Source repository (freedoom or attic) */
  commitSource: CommitSource;
  /** URL to the commit on GitHub */
  commitUrl: string;
  /** Commit SHA hash */
  commitSha: string;
  /** Commit authors for this snapshot */
  authors: AuthorInfo[];
  /** Index of the snapshot within the commit */
  commitIndex: number;
  /** Folder name/path for this snapshot */
  folder?: string;
  /** Array of sprite entries for this version */
  sprites: SpriteEntry[];
};

/**
 * Complete version history for a specific sprite code.
 * Contains all versions of a character's sprites in chronological order.
 */
export type CharacterVersions = {
  /** The sprite code (e.g., "POSS", "CYBR") */
  code: string;
  /** Array of version snapshots, ordered chronologically */
  spriteVersions: CharacterVersionSnapshot[];
};
