import {
	type Character,
	type CharacterCode,
	type CharactersMap,
	CharactersMapSchema,
} from "../schema/character";
import { readJsoncSync, resolveDataPath } from "../utils/jsonc";

const FILE_URL = resolveDataPath("../data/characters.jsonc", import.meta.url);

let cachedData: CharactersMap | null = null;

function loadData(): CharactersMap {
	if (cachedData) return cachedData;
	const json = readJsoncSync(FILE_URL);
	cachedData = CharactersMapSchema.parse(json);
	return cachedData;
}

/** Sets isolated mock data for testing */
function setData(data: CharactersMap): void {
	cachedData = data;
}

/** Resets data to original production state */
function reset(): void {
	cachedData = null;
}

/** Returns all characters' data with animation sequences */
function getAllCharacters(): CharactersMap {
	return loadData();
}

/** Returns single character's data with animation sequences */
function getCharacter(characterCode: CharacterCode): Character {
	const data = loadData();
	const character = data[characterCode];
	if (!character) {
		throw new Error(`Character with code ${characterCode} not found`);
	}
	return character;
}

export const CharacterRepository = {
	setData,
	reset,
	getAllCharacters,
	getCharacter,
};
