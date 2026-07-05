import { CharacterSchema, CharactersMapSchema, type Character, type CharacterCode, type CharactersMap } from "../schema/character";
import { readJsoncSync, resolveDataPath } from "../utils/jsonc";

const FILE_URL = resolveDataPath("../data/characters.jsonc", import.meta.url);

/** Reads Character's data from local FS and returns typed data */
export class CharacterRepository {
  private static cachedData: CharactersMap | null = null;

  private static loadData(): CharactersMap {
    if (this.cachedData) return this.cachedData;
    const json = readJsoncSync(FILE_URL);
    this.cachedData = CharactersMapSchema.parse(json);
    return this.cachedData;
  }

  /** Sets isolated mock data for testing */
  static setData(data: CharactersMap): void {
    this.cachedData = data;
  }

  /** Resets data to original production state */
  static reset(): void {
    this.cachedData = null;
  }

  /** Returns all characters' data with animation sequences */
  static getAllCharacters(): CharactersMap {
    return this.loadData();
  }

  /** Returns single character's data with animation sequences */
  static getCharacter(characterCode: CharacterCode): Character {
    const data = this.loadData();
    const character = data[characterCode];
    if (!character) {
      throw new Error(`Character with code ${characterCode} not found`);
    }
    return character;
  }
}
