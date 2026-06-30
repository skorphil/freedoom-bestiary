import { expect, test, describe, beforeEach } from "bun:test";
import { VersionCombiner } from "../src/VersionCombiner.ts";
import type { CommitSnapshot } from "../src/SnapshotBuilder.ts";

describe("VersionCombiner", () => {
  let combiner: VersionCombiner;

  beforeEach(() => {
    combiner = new VersionCombiner("POSS");
  });

  test("combine should handle empty inputs", () => {
    const result = combiner.combine([], []);
    expect(result.code).toBe("POSS");
    expect(result.spriteVersions).toEqual([]);
  });

  test("combine should create version with correct author structure", () => {
    const snapshots: CommitSnapshot[] = [
      {
        commitDate: "2023-01-01T12:00:00Z",
        commitAuthor: "John Doe",
        commitMessage: "Initial commit",
        commitSha: "sha1",
        commitUrl: "url1",
        commitSource: "freedoom",
        commitSprites: [
          {
            code: "POSS",
            filename: "possa1.png",
            url: "blob1",
            status: "A",
            authorNames: [{ name: "Artist A", relation: "Original artist" }],
          },
        ],
      },
    ];

    const result = combiner.combine(snapshots, []);
    expect(result.spriteVersions.length).toBe(1);
    expect(result.spriteVersions[0].authors).toEqual([{ name: "Artist A", relation: "Original artist" }]);
    expect(result.spriteVersions[0].sprites[0].spriteAuthors).toEqual([{ name: "Artist A", relation: "Original artist" }]);
  });

  test("buildVersionSnapshot should filter sprites by source and aggregate authors", () => {
    const frameState = new Map();
    frameState.set("a1", {
      name: "possa1.png",
      url: "url1",
      spriteAuthors: [{ name: "Author1", relation: "Artist" }],
      source: "freedoom",
      spriteState: "new"
    });
    frameState.set("b1", {
      name: "possb1.png",
      url: "url2",
      spriteAuthors: [{ name: "Author2", relation: "Refinement" }],
      source: "freedoom",
      spriteState: "new"
    });

    const snapshot: CommitSnapshot = {
      commitDate: "2023-01-01T12:00:00Z",
      commitAuthor: "John Doe",
      commitMessage: "Message",
      commitSha: "sha1",
      commitUrl: "url1",
      commitSource: "freedoom",
      commitSprites: []
    };

    const result = combiner.buildVersionSnapshot(snapshot, frameState);
    expect(result.authors.length).toBe(2);
    expect(result.authors).toContainEqual({ name: "Author1", relation: "Artist" });
    expect(result.authors).toContainEqual({ name: "Author2", relation: "Refinement" });
  });
});
