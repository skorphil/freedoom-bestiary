import { assertEquals, assertExists } from "@std/assert";
import type {
  CharacterVersions,
  CommitSnapshot,
  CommitSource,
  SpriteEntry,
  SpriteState,
} from "../src/types.ts";
// Import real classes from src/
import { VersionCombiner } from "../src/VersionCombiner.ts";

// Mock imports (commented out as requested)
import {
  createMockCommitSnapshot,
  createMockVersionCombiner,
  TEST_COMMIT_AUTHOR,
  TEST_COMMIT_MESSAGE,
} from "./mocks.ts";

Deno.test("VersionCombiner - constructor should store code", () => {
  const combiner = createMockVersionCombiner("POSS");
  assertEquals(combiner.code, "POSS");
});

Deno.test("VersionCombiner - combine should handle empty inputs", () => {
  const combiner = createMockVersionCombiner("POSS");
  const result = combiner.combine([], []);

  assertEquals(result.code, "POSS");
  assertEquals(result.spriteVersions.length, 0);
});

Deno.test("VersionCombiner - combine should create version from freedoom only", () => {
  const combiner = createMockVersionCombiner("POSS");
  const freedomSnapshots = [
    createMockCommitSnapshot("sha1", "2024-01-15T10:00:00Z", "freedoom", [
      {
        code: "POSS",
        filename: "sprites/possa1.png",
        url: "http://example.com/1",
        status: "A",
      },
    ]),
  ];

  const result = combiner.combine(freedomSnapshots, []);

  assertEquals(result.spriteVersions.length, 1);
  assertEquals(result.spriteVersions[0].commitSource, "freedoom");
  assertEquals(result.spriteVersions[0].sprites.length, 1);
  assertEquals(result.spriteVersions[0].sprites[0].spriteState, "new");
});

Deno.test("VersionCombiner - combine should create version from attic only", () => {
  const combiner = createMockVersionCombiner("POSS");
  const atticSnapshots = [
    createMockCommitSnapshot("sha2", "2024-01-15T11:00:00Z", "attic", [
      {
        code: "POSS",
        filename: "sprites/johndoe/possa1.png",
        url: "http://example.com/2",
        status: "A",
      },
    ]),
  ];

  const result = combiner.combine([], atticSnapshots);

  assertEquals(result.spriteVersions.length, 1);
  assertEquals(result.spriteVersions[0].commitSource, "attic");
});

Deno.test("VersionCombiner - combine should merge chronologically", () => {
  const combiner = createMockVersionCombiner("POSS");

  const freedomSnapshots = [
    createMockCommitSnapshot("sha1", "2024-01-15T10:00:00Z", "freedoom", [
      {
        code: "POSS",
        filename: "sprites/possa1.png",
        url: "http://example.com/1",
        status: "A",
      },
    ]),
  ];

  const atticSnapshots = [
    createMockCommitSnapshot("sha2", "2024-01-15T11:00:00Z", "attic", [
      {
        code: "POSS",
        filename: "sprites/johndoe/possa2.png",
        url: "http://example.com/2",
        status: "A",
      },
    ]),
  ];

  const result = combiner.combine(freedomSnapshots, atticSnapshots);

  assertEquals(result.spriteVersions.length, 2);
  assertEquals(result.spriteVersions[0].commitSource, "attic");
  assertEquals(result.spriteVersions[1].commitSource, "freedoom");
});

Deno.test("VersionCombiner - mergeAndSort should sort chronologically", () => {
  const combiner = createMockVersionCombiner("POSS");

  const a = createMockCommitSnapshot(
    "sha1",
    "2024-01-15T12:00:00Z",
    "freedoom",
    [],
  );
  const b = createMockCommitSnapshot(
    "sha2",
    "2024-01-15T10:00:00Z",
    "attic",
    [],
  );
  const c = createMockCommitSnapshot(
    "sha3",
    "2024-01-15T11:00:00Z",
    "freedoom",
    [],
  );

  const sorted = combiner.mergeAndSort([a], [b, c]);

  assertEquals(sorted[0].commitSha, "sha2");
  assertEquals(sorted[1].commitSha, "sha3");
  assertEquals(sorted[2].commitSha, "sha1");
});

Deno.test("VersionCombiner - deriveSpriteState should detect new sprites", () => {
  const combiner = createMockVersionCombiner("POSS");
  const frameState = new Map<string, SpriteEntry>();

  const state = combiner.deriveSpriteState(
    "a1",
    "http://example.com/1",
    frameState,
  );

  assertEquals(state, "new");
});

Deno.test("VersionCombiner - deriveSpriteState should detect updates", () => {
  const combiner = createMockVersionCombiner("POSS");
  const frameState = new Map<string, SpriteEntry>([
    ["a1", {
      name: "possa1.png",
      url: "http://example.com/old",
      spriteAuthor: "test",
      spriteState: "new",
    }],
  ]);

  const state = combiner.deriveSpriteState(
    "a1",
    "http://example.com/new",
    frameState,
  );

  assertEquals(state, "updated");
});

Deno.test("VersionCombiner - deriveSpriteState should detect unchanged", () => {
  const combiner = createMockVersionCombiner("POSS");
  const frameState = new Map<string, SpriteEntry>([
    ["a1", {
      name: "possa1.png",
      url: "http://example.com/same",
      spriteAuthor: "test",
      spriteState: "new",
    }],
  ]);

  const state = combiner.deriveSpriteState(
    "a1",
    "http://example.com/same",
    frameState,
  );

  assertEquals(state, "unchanged");
});

Deno.test("VersionCombiner - buildVersionSnapshot should filter sprites by source", () => {
  const combiner = new VersionCombiner("POSS");
  const frameState = new Map<string, SpriteEntry>([
    ["a1", {
      name: "possa1.png",
      url: "http://example.com/freedoom/1",
      spriteAuthor: "author1",
      spriteState: "new",
      source: "freedoom",
    }],
    ["b1", {
      name: "possb1.png",
      url: "http://example.com/attic/1",
      spriteAuthor: "author2",
      spriteState: "new",
      source: "attic",
    }],
  ]);

  const snapshotFreedoom = createMockCommitSnapshot("sha1", "2024-01-15T10:00:00Z", "freedoom", []);
  const versionFreedoom = combiner.buildVersionSnapshot(snapshotFreedoom, frameState);

  assertEquals(versionFreedoom.sprites.length, 1);
  assertEquals(versionFreedoom.sprites[0].url, "http://example.com/freedoom/1");

  const snapshotAttic = createMockCommitSnapshot("sha2", "2024-01-15T11:00:00Z", "attic", []);
  const versionAttic = combiner.buildVersionSnapshot(snapshotAttic, frameState);

  assertEquals(versionAttic.sprites.length, 1);
  assertEquals(versionAttic.sprites[0].url, "http://example.com/attic/1");
});

Deno.test("VersionCombiner - applySnapshot should prefer updated/new over unchanged when conflicting", () => {
  const combiner = new VersionCombiner("POSS");
  const frameState = new Map<string, SpriteEntry>([
    ["a1", {
      name: "old_a1.png",
      url: "http://example.com/old",
      spriteAuthor: "author",
      spriteState: "new",
      source: "freedoom",
    }],
  ]);

  const snapshot = createMockCommitSnapshot("sha1", "2024-01-15T10:00:00Z", "freedoom", [
    {
      code: "POSS",
      filename: "POSSA1.png",
      url: "http://example.com/old", // Unchanged
      status: "Existing",
    },
    {
      code: "POSS",
      filename: "POSSA1_new.png",
      url: "http://example.com/new", // Updated
      status: "M",
    },
  ]);

  combiner.applySnapshot(snapshot, frameState);

  const winner = frameState.get("a1");
  assertExists(winner);
  assertEquals(winner.name, "POSSA1_new.png");
  assertEquals(winner.spriteState, "updated");
});
