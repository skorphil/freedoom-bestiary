import { expect, test, describe, beforeEach } from "bun:test";
import { SnapshotBuilder } from "../src/SnapshotBuilder.ts";
import { SpritePattern } from "../src/SpritePattern.ts";
import type { AuthorResolver } from "../src/AuthorResolver.ts";
import type { GitReader } from "../src/GitReader.ts";

describe("SnapshotBuilder", () => {
  let mockReader: GitReader;
  let mockResolver: AuthorResolver;
  let builder: SnapshotBuilder;

  beforeEach(() => {
    mockReader = {
      getTreeEntries: async () => [
        { path: "sprites/possa1.png", isSymlink: false, mode: "100644", sha: "sha" }
      ],
    } as any;
    
    mockResolver = {
      resolveAuthorsBatch: async (context: any, sprites: any[]) => {
        const mapping: any = {};
        for (const s of sprites) {
          mapping[s.url] = [{ name: "AI Artist", relation: "Determined by AI" }];
        }
        return mapping;
      }
    } as any;

    builder = new SnapshotBuilder(
      mockReader,
      new SpritePattern("POSS"),
      mockResolver,
      { githubBaseUrl: "https://github.com", followSymlinks: true }
    );
  });

  test("should build snapshot and resolve authors via resolver", async () => {
    const unit = {
      sha: "sha1",
      date: "2023-01-01",
      author: "John",
      message: "msg",
      folder: null,
      changesMap: new Map([["sprites/possa1.png", "A"]])
    };

    const snapshot = await builder.build(unit as any, "freedoom");
    expect(snapshot).not.toBeNull();
    expect(snapshot?.commitSprites[0].authorNames).toEqual([
      { name: "AI Artist", relation: "Determined by AI" }
    ]);
  });
});
