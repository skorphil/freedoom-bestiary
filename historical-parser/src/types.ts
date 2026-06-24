/**
 * @module parsers/types
 *
 * Core type definitions and exports for the historical-parser module.
 *
 * This module provides:
 * - Re-exports of all parser classes
 * - Shared type definitions for git operations
 * - Domain types for sprite versioning
 * - Pipeline output types
 *
 * @example
 * ```typescript
 * import {
 *   SpritePattern,
 *   GitReader,
 *   FreedomParser,
 *   type CommitSnapshot,
 *   type CharacterVersions
 * } from "./types.ts";
 *
 * const parser = new FreedomParser("/path/to/freedoom.git", "POSS");
 * const snapshots = await parser.parse();
 * ```
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
export { AuthorResolver, SpritePattern } from "./SpritePattern.ts";
export { GitReader } from "./GitReader.ts";
export { CommitLogScanner } from "./CommitLogScanner.ts";
export { SnapshotBuilder } from "./SnapshotBuilder.ts";
export { AtticParser, BaseParser, FreedomParser } from "./BaseParser.ts";
export { VersionCombiner } from "./VersionCombiner.ts";

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
 * Represents a sprite entry in a version snapshot.
 * Contains information about a specific sprite frame.
 */
export type SpriteEntry = {
  /** Frame name/key (e.g., "a1", "b2") */
  name: string;
  /** URL to the sprite image */
  url: string;
  /** Author who created/modified this sprite */
  spriteAuthor: string;
  /** State of the sprite (new, updated, unchanged) */
  spriteState: SpriteState;
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
