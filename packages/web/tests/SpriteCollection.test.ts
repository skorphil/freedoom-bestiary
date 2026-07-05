import { expect, test, beforeEach, afterEach } from "bun:test";
import { SpritesheetsCollection } from "../app/src/models/SpritesheetsCollection.ts";
import { ContributorRepository } from "@freedoom-bestiary/database";

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
      contributions: [],
      sprites: [
        { 
          author: "Author 2", 
          contributions: [{ contributorId: "author-2", relation: "Artist" }] 
        } as any
      ],
    },
    {
      date: "2023-01-01",
      sha: "sha1",
      author: "Author 1",
      commitMessage: "Original Cyberdemon",
      commitUrl: "https://github.com/freedoom/attic/commit/sha1",
      spritesheetPath: "path1.webp",
      source: "attic",
      contributions: [],
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
      contributions: [],
      sprites: [],
    },
  ],
};

beforeEach(() => {
  ContributorRepository.setData({
    "author-2": {
      name: "Author 2",
      links: []
    }
  } as any);
});

afterEach(() => {
  ContributorRepository.reset();
});

test("SpritesheetsCollection - getAllCodes", () => {
  const collection = new SpritesheetsCollection(mockData as any);
  expect(collection.getAllCodes()).toEqual(["CYBR", "SPID"]);
});

test("SpritesheetsCollection - getHistory", () => {
  const collection = new SpritesheetsCollection(mockData as any);
  expect(collection.getHistory("CYBR" as any).length).toEqual(2);
  expect(collection.getHistory("CYBR" as any)[0].sha).toEqual("sha2"); 
  expect(collection.getHistory("NONEXISTENT" as any)).toEqual([]);
});

test("SpritesheetsCollection - getLatest", () => {
  const collection = new SpritesheetsCollection(mockData as any);
  const latest = collection.getLatest("CYBR" as any);
  expect(latest?.sha).toEqual("sha2");
  expect(latest?.date).toEqual("2023-01-02");
});

test("SpritesheetsCollection - isAtticEntry", () => {
  const collection = new SpritesheetsCollection(mockData as any);
  const history = collection.getHistory("CYBR" as any);
  expect(collection.isAtticEntry(history[0])).toEqual(false);
  expect(collection.isAtticEntry(history[1])).toEqual(true);
});

test("SpritesheetsCollection - getLatestLiveEntry", () => {
  const collection = new SpritesheetsCollection(mockData as any);
  const history = collection.getHistory("CYBR" as any);
  const latestLive = collection.getLatestLiveEntry(history);
  expect(latestLive?.sha).toEqual("sha2");
});

test("SpritesheetsCollection - getUniqueAuthors", () => {
  const collection = new SpritesheetsCollection(mockData as any);
  const history = collection.getHistory("CYBR" as any);
  const authors = collection.getUniqueAuthors(history[0]);
  expect(authors).toEqual(["Author 2"]);
});
