import {
	type Character,
	type CharacterCode,
	CharacterSchema,
	type CharactersMap,
	CharactersMapSchema,
} from "../schema/character";
import { readJsoncSync, resolveDataPath } from "../utils/jsonc";

const FILE_URL = resolveDataPath("../data/characters.jsonc", import.meta.url);

/** Reads Character's data from local FS and returns typed data */
export class CharacterRepository {
	private static cachedData: CharactersMap | null = null;

	private static loadData(): CharactersMap {
		if (CharacterRepository.cachedData) return CharacterRepository.cachedData;
		const json = readJsoncSync(FILE_URL);
		CharacterRepository.cachedData = CharactersMapSchema.parse(json);
		return CharacterRepository.cachedData;
	}

	/** Sets isolated mock data for testing */
	static setData(data: CharactersMap): void {
		CharacterRepository.cachedData = data;
	}

	/** Resets data to original production state */
	static reset(): void {
		CharacterRepository.cachedData = null;
	}

	/** Returns all characters' data with animation sequences */
	static getAllCharacters(): CharactersMap {
		return CharacterRepository.loadData();
	}

	/** Returns single character's data with animation sequences */
	static getCharacter(characterCode: CharacterCode): Character {
		const data = CharacterRepository.loadData();
		const character = data[characterCode];
		if (!character) {
			throw new Error(`Character with code ${characterCode} not found`);
		}
		return character;
	}
}
