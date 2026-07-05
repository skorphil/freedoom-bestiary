import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { CharacterRepository } from "../repository/CharacterRepository";

describe("CharacterRepository", () => {
	const mockCharacters = {
		TEST: {
			doomName: "Test Monster",
			freedoomName: "Test Zombie",
			animations: {
				idling: [{ frame: "A", delay: 1 }],
			},
		},
	};

	beforeEach(() => {
		CharacterRepository.setData(mockCharacters as any);
	});

	afterEach(() => {
		CharacterRepository.reset();
	});

	test("getAllCharacters returns all characters", () => {
		const characters = CharacterRepository.getAllCharacters();
		expect(characters).toBeDefined();
		expect(Object.keys(characters).length).toBe(1);
		expect(characters["TEST"]).toBeDefined();
		expect(characters["TEST"]?.doomName).toBe("Test Monster");
	});

	test("getCharacter returns a single character", () => {
		const character = CharacterRepository.getCharacter("TEST" as any);
		expect(character).toBeDefined();
		expect(character.doomName).toBe("Test Monster");
		expect(character.freedoomName).toBe("Test Zombie");
	});

	test("getCharacter throws error for invalid code", () => {
		expect(() => {
			CharacterRepository.getCharacter("INVALID" as any);
		}).toThrow("Character with code INVALID not found");
	});
});
