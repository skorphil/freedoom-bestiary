import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as SpritesheetRepository from "../repository/SpritesheetRepository.ts";
import type { SpritesheetsMap } from "../schema/spritesheet";

describe("SpritesheetRepository", () => {
	const testSha = "27aca39126c0f021e543516119c9d3b2500575ac";
	const mockSpritesheets = {
		POSS: {
			"sheet-1": {
				spritesheetId: "sheet-1",
				commitSha: testSha,
				fileName: "poss-sheet.webp",
				date: "2023-01-01",
				author: "Artist A",
				commitMessage: "Initial commit",
				commitUrl: "url1",
				source: "freedoom",
				sprites: [],
			},
		},
	};

	beforeEach(() => {
		SpritesheetRepository.setData(mockSpritesheets as SpritesheetsMap);
	});

	afterEach(() => {
		SpritesheetRepository.reset();
	});

	test("getAllSpritesheets returns all spritesheets", async () => {
		const spritesheets = await SpritesheetRepository.getAllSpritesheets();
		expect(spritesheets).toBeDefined();
		expect(Object.keys(spritesheets).length).toBeGreaterThan(0);
		expect(spritesheets.POSS).toBeDefined();
	});

	test("getSpritesheetById returns a single spritesheet", async () => {
		const spritesheet = await SpritesheetRepository.getSpritesheetById(
			"POSS",
			"sheet-1",
		);
		expect(spritesheet).toBeDefined();
		expect(spritesheet.spritesheetId).toBe("sheet-1");
	});

	test("getSpritesheetById throws error for invalid id", async () => {
		try {
			await SpritesheetRepository.getSpritesheetById("POSS", "invalid-id");
			expect(true).toBe(false);
		} catch (e) {
			expect((e as Error).message).toBe(
				"Spritesheet with ID invalid-id not found for character POSS",
			);
		}
	});

	test("getSpritesheetById throws error for invalid character", async () => {
		try {
			await SpritesheetRepository.getSpritesheetById("INVALID", "sheet-1");
			expect(true).toBe(false);
		} catch (e) {
			expect((e as Error).message).toBe(
				"No spritesheets found for character INVALID",
			);
		}
	});

	test("getSpritesheetsByCommit returns spritesheets for a specific commit", async () => {
		const spritesheets =
			await SpritesheetRepository.getSpritesheetsByCommit(testSha);
		expect(spritesheets).toBeArray();
		expect(spritesheets.length).toBe(1);
		expect(spritesheets[0].commitSha).toBe(testSha);
	});

	test("getSpritesheetsByCommit returns empty array for non-existent commit", async () => {
		const spritesheets =
			await SpritesheetRepository.getSpritesheetsByCommit("invalid-sha");
		expect(spritesheets).toBeArray();
		expect(spritesheets.length).toBe(0);
	});
});
