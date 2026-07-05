import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { CharacterRepository } from "../repository/CharacterRepository";
import type { CharacterCode, CharactersMap } from "../schema/character";

describe("CharacterRepository", () => {
	const mockCharacters: CharactersMap = {
		TEST: {
			doomName: "Test Monster",
			freedoomName: "Test Zombie",
			description: "A test monster for unit testing",
			animations: {
				idling: [{ frame: "A", delay: 1 }],
			},
		},
	};

	beforeEach(() => {
		CharacterRepository.setData(mockCharacters);
	});

	afterEach(() => {
		CharacterRepository.reset();
	});

	test("getAllCharacters returns all characters", () => {
		const characters = CharacterRepository.getAllCharacters();
		expect(characters).toBeDefined();
		expect(Object.keys(characters).length).toBe(1);
		expect(characters.TEST).toBeDefined();
		expect(characters.TEST?.doomName).toBe("Test Monster");
	});

	test("getCharacter returns a single character", () => {
		const character = CharacterRepository.getCharacter("TEST" as CharacterCode);
		expect(character).toBeDefined();
		expect(character.doomName).toBe("Test Monster");
		expect(character.freedoomName).toBe("Test Zombie");
	});

	test("getCharacter throws error for invalid code", () => {
		expect(() => {
			CharacterRepository.getCharacter("INVALID" as CharacterCode);
		}).toThrow("Character with code INVALID not found");
	});
});
