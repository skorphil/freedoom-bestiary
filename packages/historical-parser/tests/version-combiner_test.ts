import { expect, test } from "bun:test";
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

test("VersionCombiner - constructor should store code", () => {
  const combiner = createMockVersionCombiner("POSS");
  expect(combiner.code).toBe("POSS");
});

test("VersionCombiner - combine should handle empty inputs", () => {
  const combiner = createMockVersionCombiner("POSS");
  const result = combiner.combine([], []);

  expect(result.code).toBe("POSS");
  expect(result.spriteVersions.length).toBe(0);
});

test("VersionCombiner - combine should create version from freedoom only", () => {
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

  expect(result.spriteVersions.length).toBe(1);
  expect(result.spriteVersions[0].commitSource).toBe("freedoom");
  expect(result.spriteVersions[0].sprites.length).toBe(1);
  expect(result.spriteVersions[0].sprites[0].spriteState).toBe("new");
});

test("VersionCombiner - combine should create version from attic only", () => {
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

  expect(result.spriteVersions.length).toBe(1);
  expect(result.spriteVersions[0].commitSource).toBe("attic");
});

test("VersionCombiner - combine should merge chronologically", () => {
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

  expect(result.spriteVersions.length).toBe(2);
  expect(result.spriteVersions[0].commitSource).toBe("attic");
  expect(result.spriteVersions[1].commitSource).toBe("freedoom");
});

test("VersionCombiner - mergeAndSort should sort chronologically", () => {
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

  const sorted = (combiner as any).mergeAndSort([a], [b, c]);

  expect(sorted[0].commitSha).toBe("sha2");
  expect(sorted[1].commitSha).toBe("sha3");
  expect(sorted[2].commitSha).toBe("sha1");
});

test("VersionCombiner - deriveSpriteState should detect new sprites", () => {
  const combiner = createMockVersionCombiner("POSS");
  const frameState = new Map<string, SpriteEntry>();

  const state = (combiner as any).deriveSpriteState(
    "a1",
    "http://example.com/1",
    frameState,
  );

  expect(state).toBe("new");
});

test("VersionCombiner - deriveSpriteState should detect updates", () => {
  const combiner = createMockVersionCombiner("POSS");
  const frameState = new Map<string, SpriteEntry>([
    ["a1", {
      name: "possa1.png",
      url: "http://example.com/old",
      spriteAuthor: "test",
      spriteState: "new",
    }],
  ]);

  const state = (combiner as any).deriveSpriteState(
    "a1",
    "http://example.com/new",
    frameState,
  );

  expect(state).toBe("updated");
});

test("VersionCombiner - deriveSpriteState should detect unchanged", () => {
  const combiner = createMockVersionCombiner("POSS");
  const frameState = new Map<string, SpriteEntry>([
    ["a1", {
      name: "possa1.png",
      url: "http://example.com/same",
      spriteAuthor: "test",
      spriteState: "new",
    }],
  ]);

  const state = (combiner as any).deriveSpriteState(
    "a1",
    "http://example.com/same",
    frameState,
  );

  expect(state).toBe("unchanged");
});

test("VersionCombiner - buildVersionSnapshot should filter sprites by source", () => {
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
  const versionFreedoom = (combiner as any).buildVersionSnapshot(snapshotFreedoom, frameState);

  expect(versionFreedoom.sprites.length).toBe(1);
  expect(versionFreedoom.sprites[0].url).toBe("http://example.com/freedoom/1");

  const snapshotAttic = createMockCommitSnapshot("sha2", "2024-01-15T11:00:00Z", "attic", []);
  const versionAttic = (combiner as any).buildVersionSnapshot(snapshotAttic, frameState);

  expect(versionAttic.sprites.length).toBe(1);
  expect(versionAttic.sprites[0].url).toBe("http://example.com/attic/1");
});

test("VersionCombiner - applySnapshot should prefer updated/new over unchanged when conflicting", () => {
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

  (combiner as any).applySnapshot(snapshot, frameState);

  const winner = frameState.get("a1");
  expect(winner).toBeDefined();
  expect(winner!.name).toBe("POSSA1_new.png");
  expect(winner!.spriteState).toBe("updated");
});
