import { expect, test, beforeEach, afterEach } from "bun:test";
import { SpritesheetsCollection } from "../app/src/models/SpritesheetsCollection.ts";
import { CharacterRepository } from "@freedoom-bestiary/database";

const mockData = {
	CYBR: {
		uuid2: {
			commitDate: "2023-01-02",
			commitSha: "sha2",
			commitMessage: "Updated Cyberdemon",
			commitUrl: "https://github.com/freedoom/freedoom/commit/sha2",
			fileName: "path2.webp",
			filePath: "path2.webp",
			source: "freedoom",
			spritesheetId: "uuid2",
			contributions: [],
			sprites: [
				{
					contributions: [{ contributorId: "author-2", relation: "Artist" }],
					frame: "A",
					angle: 0,
					x: 0,
					y: 0,
					width: 10,
					height: 10,
					state: "new",
					spriteUrl: "",
				},
			],
		},
		uuid1: {
			commitDate: "2023-01-01",
			commitSha: "sha1",
			commitMessage: "Original Cyberdemon",
			commitUrl: "https://github.com/freedoom/attic/commit/sha1",
			fileName: "path1.webp",
			filePath: "path1.webp",
			source: "attic",
			spritesheetId: "uuid1",
			contributions: [],
			sprites: [],
		},
	},
	SPID: {
		uuid3: {
			commitDate: "2023-01-01",
			commitSha: "sha3",
			commitMessage: "Spider Mastermind",
			commitUrl: "https://github.com/freedoom/freedoom/commit/sha3",
			fileName: "path3.webp",
			filePath: "path3.webp",
			source: "freedoom",
			spritesheetId: "uuid3",
			contributions: [],
			sprites: [],
		},
	},
};

beforeEach(() => {
	CharacterRepository.setData({
		CYBR: { freedoomName: "Cyberdemon", animations: {} },
		SPID: { freedoomName: "Spider Mastermind", animations: {} },
	} as any);
});

afterEach(() => {
	CharacterRepository.reset();
});

test("SpritesheetsCollection - getAllCodes", () => {
	const collection = new SpritesheetsCollection(mockData as any);
	expect(collection.getAllCodes()).toEqual(["CYBR", "SPID"]);
});

test("SpritesheetsCollection - getHistory", () => {
	const collection = new SpritesheetsCollection(mockData as any);
	expect(collection.getHistory("CYBR" as any).length).toEqual(2);
	expect(
		collection.getHistory("CYBR" as any).map((s) => s.data.commitSha),
	).toContain("sha2");
	expect(collection.getHistory("NONEXISTENT" as any)).toEqual([]);
});

test("SpritesheetsCollection - getLatest", () => {
	const collection = new SpritesheetsCollection(mockData as any);
	const latest = collection.getLatest("CYBR" as any);
	expect(latest?.data.commitSha).toEqual("sha2");
});

test("SpritesheetsCollection - isAtticEntry", () => {
	const collection = new SpritesheetsCollection(mockData as any);
	const history = collection
		.getHistory("CYBR" as any)
		.sort(
			(a, b) =>
				new Date(a.data.commitDate).getTime() -
				new Date(b.data.commitDate).getTime(),
		);
	expect(collection.isAtticEntry(history[1])).toEqual(false); // sha2 is later
	expect(collection.isAtticEntry(history[0])).toEqual(true); // sha1 is earlier and attic
});

test("SpritesheetsCollection - getLatestLiveEntry", () => {
	const collection = new SpritesheetsCollection(mockData as any);
	const history = collection.getHistory("CYBR" as any);
	const latestLive = collection.getLatestLiveEntry(history);
	expect(latestLive?.data.commitSha).toEqual("sha2");
});

test("SpritesheetsCollection - getUniqueAuthors", () => {
	const collection = new SpritesheetsCollection(mockData as any);
	const latest = collection.getLatest("CYBR" as any);
	const authors = collection.getUniqueAuthors(latest!);
	expect(authors).toEqual(["author-2"]);
});
