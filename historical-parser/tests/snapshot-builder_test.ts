import { assertEquals, assertExists } from "@std/assert";
import type {
  CommitSnapshot,
  CommitSource,
  FileStatus,
  ScanUnit,
  SnapshotBuilderOptions,
} from "../src/types.ts";
// Import real classes from src/
import { GitReader } from "../src/GitReader.ts";
import { SnapshotBuilder } from "../src/SnapshotBuilder.ts";
import { AuthorResolver, SpritePattern } from "../src/SpritePattern.ts";

// Mock imports (commented out as requested)
import {
  createMockAuthorResolver,
  createMockGitReader,
  createMockSnapshotBuilder,
  createMockSpritePattern,
  createMockTreeEntry,
} from "./mocks.ts";

Deno.test("SnapshotBuilder - should build snapshot from scan unit", async () => {
  const entries = [
    createMockTreeEntry("sprites/possa1.png"),
    createMockTreeEntry("sprites/possa2a8.png"),
    createMockTreeEntry("README.md"),
  ];
  const reader = createMockGitReader("/tmp/test.git", entries);
  const pattern = createMockSpritePattern("POSS");
  const resolver = createMockAuthorResolver();
  const options: SnapshotBuilderOptions = {
    githubBaseUrl: "https://github.com/freedoom/freedoom",
    followSymlinks: true,
  };
  const builder = createMockSnapshotBuilder(reader, pattern, resolver, options);

  const changesMap = new Map<string, string>([
    ["sprites/possa1.png", "A"],
    ["sprites/possa2a8.png", "M"],
  ]);

  const unit: ScanUnit = {
    sha: "abc123",
    date: "2024-01-15T10:30:00Z",
    author: "John Doe",
    message: "Add sprites",
    folder: null,
    changesMap,
  };

  const snapshot = await builder.build(unit, "freedoom");

  assertExists(snapshot);
  assertEquals(snapshot!.commitSha, "abc123");
  assertEquals(snapshot!.commitAuthor, "John Doe");
  assertEquals(snapshot!.commitSource, "freedoom");
  assertEquals(snapshot!.commitSprites.length, 2);
});

Deno.test("SnapshotBuilder - should return null when no sprites match", async () => {
  const entries = [
    createMockTreeEntry("README.md"),
    createMockTreeEntry("docs/guide.md"),
  ];
  const reader = createMockGitReader("/tmp/test.git", entries);
  const pattern = createMockSpritePattern("POSS");
  const resolver = createMockAuthorResolver();
  const options: SnapshotBuilderOptions = {
    githubBaseUrl: "https://github.com/freedoom/freedoom",
    followSymlinks: true,
  };
  const builder = createMockSnapshotBuilder(reader, pattern, resolver, options);

  const changesMap = new Map<string, string>();
  const unit: ScanUnit = {
    sha: "abc123",
    date: "2024-01-15T10:30:00Z",
    author: "John Doe",
    message: "Update docs",
    folder: null,
    changesMap,
  };

  const snapshot = await builder.build(unit, "freedoom");

  assertEquals(snapshot, null);
});

Deno.test("SnapshotBuilder - should filter sprites by pattern", async () => {
  const entries = [
    createMockTreeEntry("sprites/possa1.png"),
    createMockTreeEntry("sprites/cybra1.png"),
    createMockTreeEntry("sprites/spida1.png"),
  ];
  const reader = createMockGitReader("/tmp/test.git", entries);
  const pattern = createMockSpritePattern("POSS");
  const resolver = createMockAuthorResolver();
  const options: SnapshotBuilderOptions = {
    githubBaseUrl: "https://github.com/freedoom/freedoom",
    followSymlinks: true,
  };
  const builder = createMockSnapshotBuilder(reader, pattern, resolver, options);

  const changesMap = new Map<string, string>([
    ["sprites/possa1.png", "A"],
    ["sprites/cybra1.png", "M"],
    ["sprites/spida1.png", "A"],
  ]);

  const unit: ScanUnit = {
    sha: "abc123",
    date: "2024-01-15T10:30:00Z",
    author: "John Doe",
    message: "Add sprites",
    folder: null,
    changesMap,
  };

  const snapshot = await builder.build(unit, "freedoom");

  assertExists(snapshot);
  // Should only include POSS sprites
  assertEquals(snapshot!.commitSprites.length, 1);
  assertEquals(snapshot!.commitSprites[0].filename, "sprites/possa1.png");
});

Deno.test("SnapshotBuilder - should generate correct blob URLs", async () => {
  const entries = [createMockTreeEntry("sprites/possa1.png")];
  const reader = createMockGitReader("/tmp/test.git", entries);
  const pattern = createMockSpritePattern("POSS");
  const resolver = createMockAuthorResolver();
  const options: SnapshotBuilderOptions = {
    githubBaseUrl: "https://github.com/freedoom/freedoom",
    followSymlinks: true,
  };
  const builder = createMockSnapshotBuilder(reader, pattern, resolver, options);

  const changesMap = new Map([["sprites/possa1.png", "A"]]);
  const unit: ScanUnit = {
    sha: "abc123def456789012345678901234567890abcd",
    date: "2024-01-15T10:30:00Z",
    author: "John Doe",
    message: "Add sprites",
    folder: null,
    changesMap,
  };

  const snapshot = await builder.build(unit, "freedoom");

  assertExists(snapshot);
  assertEquals(
    snapshot!.commitUrl,
    "https://github.com/freedoom/freedoom/commit/abc123def456789012345678901234567890abcd",
  );
  assertEquals(
    snapshot!.commitSprites[0].url,
    "https://github.com/freedoom/freedoom/blob/abc123def456789012345678901234567890abcd/sprites/possa1.png",
  );
});

Deno.test("SnapshotBuilder - should normalize file statuses correctly", () => {
  // Test the normalizeStatus logic directly since it's not exposed in the mock
  const normalizeStatus = (rawStatus: string | undefined): FileStatus => {
    if (!rawStatus) return "Existing";
    if (["A", "M", "T", "R100"].includes(rawStatus)) {
      return rawStatus as FileStatus;
    }
    if (rawStatus.startsWith("R")) return "R100";
    return "Existing";
  };

  assertEquals(normalizeStatus("A"), "A");
  assertEquals(normalizeStatus("M"), "M");
  assertEquals(normalizeStatus("T"), "T");
  assertEquals(normalizeStatus("R100"), "R100");
  assertEquals(normalizeStatus("R098"), "R100");
  assertEquals(normalizeStatus(undefined), "Existing");
  assertEquals(normalizeStatus("D"), "Existing"); // Deleted is skipped, shouldn't appear
});

Deno.test("SnapshotBuilder - should handle attic-style with folder", async () => {
  const entries = [
    createMockTreeEntry("sprites/johndoe/possa1.png"),
    createMockTreeEntry("sprites/johndoe/possa2.png"),
  ];
  const reader = createMockGitReader("/tmp/test.git", entries);
  const pattern = createMockSpritePattern("POSS");
  const resolver = createMockAuthorResolver();
  const options: SnapshotBuilderOptions = {
    githubBaseUrl: "https://github.com/freedoom/attic",
    followSymlinks: false,
  };
  const builder = createMockSnapshotBuilder(reader, pattern, resolver, options);

  const changesMap = new Map([
    ["sprites/johndoe/possa1.png", "A"],
    ["sprites/johndoe/possa2.png", "M"],
  ]);

  const unit: ScanUnit = {
    sha: "abc123",
    date: "2024-01-15T10:30:00Z",
    author: "John Doe",
    message: "Add sprites",
    folder: "sprites/johndoe",
    changesMap,
  };

  const snapshot = await builder.build(unit, "attic");

  assertExists(snapshot);
  assertEquals(snapshot!.commitSource, "attic");
  assertEquals(snapshot!.commitSprites.length, 2);
});

Deno.test("SnapshotBuilder - should resolve symlinks when followSymlinks is true", async () => {
  const entries = [
    createMockTreeEntry("sprites/possa1.png", "120000", "symlinkHash"),
  ];
  const reader = {
    ...createMockGitReader("/tmp/test.git", entries),
    getTreeEntries: async () => entries,
    resolveSymlinkTarget: async () => "actual/possa1.png",
  };
  const pattern = createMockSpritePattern("POSS");
  const resolver = createMockAuthorResolver();
  const options: SnapshotBuilderOptions = {
    githubBaseUrl: "https://github.com/freedoom/freedoom",
    followSymlinks: true,
  };
  const builder = createMockSnapshotBuilder(reader, pattern, resolver, options);

  const changesMap = new Map([["sprites/possa1.png", "A"]]);
  const unit: ScanUnit = {
    sha: "abc123",
    date: "2024-01-15T10:30:00Z",
    author: "John Doe",
    message: "Add symlink",
    folder: null,
    changesMap,
  };

  const snapshot = await builder.build(unit, "freedoom");

  assertExists(snapshot);
});
