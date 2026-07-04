import { expect, test, describe } from "bun:test";
import { SpritesheetRepository } from "../repository/SpritesheetRepository";

describe("SpritesheetRepository", () => {
  const testId = "bab4b9b3-6268-4478-b986-27e0059f6642";
  const testSha = "57246cae8f7901d4bc63072f9632685d1e3b507d";

  test("getAllSpritesheets returns all spritesheets", () => {
    const spritesheets = SpritesheetRepository.getAllSpritesheets();
    expect(spritesheets).toBeDefined();
    expect(Object.keys(spritesheets).length).toBeGreaterThan(0);
    expect(spritesheets["BOSS_57246cae8f7901d4bc63072f9632685d1e3b507d_0"]).toBeDefined();
  });

  test("getSpritesheetById returns a single spritesheet", () => {
    const spritesheet = SpritesheetRepository.getSpritesheetById(testId);
    expect(spritesheet).toBeDefined();
    expect(spritesheet.spritesheetId).toBe(testId);
    expect(spritesheet.commitSha).toBe(testSha);
  });

  test("getSpritesheetById throws error for invalid id", () => {
    expect(() => {
      SpritesheetRepository.getSpritesheetById("00000000-0000-0000-0000-000000000000");
    }).toThrow("Spritesheet with ID 00000000-0000-0000-0000-000000000000 not found");
  });

  test("getSpritesheetsByCommit returns spritesheets for a specific commit", () => {
    const spritesheets = SpritesheetRepository.getSpritesheetsByCommit(testSha);
    expect(spritesheets).toBeArray();
    expect(spritesheets.length).toBeGreaterThan(0);
    expect(spritesheets.every(s => s.commitSha === testSha)).toBeTrue();
  });

  test("getSpritesheetsByCommit returns empty array for non-existent commit", () => {
    const spritesheets = SpritesheetRepository.getSpritesheetsByCommit("invalid-sha");
    expect(spritesheets).toBeArray();
    expect(spritesheets.length).toBe(0);
  });
});
