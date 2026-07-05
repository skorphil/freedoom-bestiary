import charactersJson from "../data/characters.jsonc"
import { CharacterSchema, CharactersMapSchema, type Character, type CharacterCode, type CharactersMap } from "../schema/character";

/** Reads Character's data from local FS and returns typed data */
export class CharacterRepository {
  static data: CharactersMap = CharactersMapSchema.parse(charactersJson)

  /** Sets isolated mock data for testing */
  static setData(data: CharactersMap): void {
    this.data = data;
  }

  /** Resets data to original production state */
  static reset(): void {
    this.data = CharactersMapSchema.parse(charactersJson);
  }

  /** Returns all characters' data with animation sequences */
  static getAllCharacters(): CharactersMap {
    return this.data
  }

  /** Returns single character's data with animation sequences */
  static getCharacter(characterCode: CharacterCode): Character {
    const character = this.data[characterCode]
    if (!character) {
      throw new Error(`Character with code ${characterCode} not found`)
    }
    return character
  }
}
