import { expect, test } from "bun:test";
import { SpriteCollection } from "../app/src/models/SpritesheetsCollection.ts";

const mockData = {
  "CYBR": [
    {
      date: "2023-01-02",
      sha: "sha2",
      author: "Author 2",
      commitMessage: "Updated Cyberdemon",
      commitUrl: "https://github.com/freedoom/freedoom/commit/sha2",
      spritesheetPath: "path2.webp",
      source: "freedoom",
      sprites: [],
      animations: {
        idling: {
          angles: [{ angle: 0, webp: "out/animations/cybr.idle.0.sha2.webp" }],
        },
      },
    },
    {
      date: "2023-01-01",
      sha: "sha1",
      author: "Author 1",
      commitMessage: "Original Cyberdemon",
      commitUrl: "https://github.com/freedoom/attic/commit/sha1",
      spritesheetPath: "path1.webp",
      source: "attic",
      sprites: [],
    },
  ],
  "SPID": [
    {
      date: "2023-01-01",
      sha: "sha3",
      author: "Author 3",
      commitMessage: "Spider Mastermind",
      commitUrl: "https://github.com/freedoom/freedoom/commit/sha3",
      spritesheetPath: "path3.webp",
      source: "freedoom",
      sprites: [],
    },
  ],
};

test("SpriteCollection - getAllCodes", () => {
  const collection = new SpriteCollection(mockData as any);
  expect(collection.getAllCodes()).toEqual(["CYBR", "SPID"]);
});

test("SpriteCollection - getHistory", () => {
  const collection = new SpriteCollection(mockData as any);
  expect(collection.getHistory("CYBR").length).toEqual(2);
  expect(collection.getHistory("cybr")[0].sha).toEqual("sha2"); // Case-insensitivity
  expect(collection.getHistory("NONEXISTENT")).toEqual([]);
});

test("SpriteCollection - getLatest", () => {
  const collection = new SpriteCollection(mockData as any);
  const latest = collection.getLatest("CYBR");
  expect(latest?.sha).toEqual("sha2");
  expect(latest?.date).toEqual("2023-01-02");
});

test("SpriteCollection - isAtticEntry", () => {
  const collection = new SpriteCollection(mockData as any);
  const history = collection.getHistory("CYBR");
  expect(collection.isAtticEntry(history[0])).toEqual(false);
  expect(collection.isAtticEntry(history[1])).toEqual(true);
});

test("SpriteCollection - getLatestLiveEntry", () => {
  const collection = new SpriteCollection(mockData as any);
  const history = collection.getHistory("CYBR");
  const latestLive = collection.getLatestLiveEntry(history);
  expect(latestLive?.sha).toEqual("sha2");
});

test("SpriteCollection - getUniqueAuthors", () => {
  const collection = new SpriteCollection(mockData as any);
  const history = collection.getHistory("CYBR");
  const authors = collection.getUniqueAuthors(history);
  expect(authors).toEqual(["Author 1", "Author 2"]);
});
