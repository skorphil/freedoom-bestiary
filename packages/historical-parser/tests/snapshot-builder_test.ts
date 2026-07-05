import { beforeEach, describe, expect, test } from "bun:test";
import type { AuthorResolver } from "../src/AuthorResolver.ts";
import type { ScanUnit } from "../src/CommitLogScanner.ts";
import type { GitReader, TreeEntry } from "../src/GitReader.ts";
import { SnapshotBuilder } from "../src/SnapshotBuilder.ts";
import { SpritePattern } from "../src/SpritePattern.ts";

describe("SnapshotBuilder", () => {
	let mockReader: GitReader;
	let mockResolver: AuthorResolver;
	let builder: SnapshotBuilder;

	beforeEach(() => {
		mockReader = {
			getTreeEntries: async (_sha: string, _folderPath?: string) => [
				{
					path: "sprites/possa1.png",
					isSymlink: false,
					mode: "100644",
					objectHash: "sha",
					type: "blob",
				} as TreeEntry,
			],
		} as GitReader;

		mockResolver = {
			resolveAuthorsBatch: async (
				_context: { author: string; message: string; sha: string },
				sprites: Array<{ url: string; path: string }>,
			) => {
				const mapping: Record<
					string,
					Array<{ name: string; relation: string; contributorId: string }>
				> = {};
				for (const s of sprites) {
					mapping[s.url] = [
						{
							name: "AI Artist",
							relation: "Determined by AI",
							contributorId: "ai-artist",
						},
					];
				}
				return mapping;
			},
		} as AuthorResolver;

		builder = new SnapshotBuilder(
			mockReader,
			new SpritePattern("POSS"),
			mockResolver,
			{ githubBaseUrl: "https://github.com", followSymlinks: true },
		);
	});

	test("should build snapshot and resolve authors via resolver", async () => {
		const unit: ScanUnit = {
			sha: "sha1",
			date: "2023-01-01",
			author: "John",
			message: "msg",
			folder: null,
			changesMap: new Map([["sprites/possa1.png", "A"]]),
		};

		const snapshot = await builder.build(unit, "freedoom");
		expect(snapshot).not.toBeNull();
		expect(snapshot?.commitSprites[0].authorNames).toEqual([
			{
				name: "AI Artist",
				relation: "Determined by AI",
				contributorId: "ai-artist",
			},
		]);
	});
});
