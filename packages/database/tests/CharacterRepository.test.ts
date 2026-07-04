import { expect, test, describe } from "bun:test";
import { CharacterRepository } from "../repository/CharacterRepository";

describe("CharacterRepository", () => {
  test("getAllCharacters returns all characters", () => {
    const characters = CharacterRepository.getAllCharacters();
    expect(characters).toBeDefined();
    expect(Object.keys(characters).length).toBeGreaterThan(0);
    expect(characters["POSS"]).toBeDefined();
    expect(characters["POSS"]?.doomName).toBe("Zombieman");
  });

  test("getCharacter returns a single character", () => {
    const character = CharacterRepository.getCharacter("POSS");
    expect(character).toBeDefined();
    expect(character.doomName).toBe("Zombieman");
    expect(character.freedoomName).toBe("Zombie");
  });

  test("getCharacter throws error for invalid code", () => {
    expect(() => {
      // @ts-expect-error - testing invalid input
      CharacterRepository.getCharacter("INVALID");
    }).toThrow("Character with code INVALID not found");
  });
});
