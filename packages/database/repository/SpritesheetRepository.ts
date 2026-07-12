import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
	type Spritesheet,
	SpritesheetSchema,
	type SpritesheetsMap,
	SpritesheetsMapSchema,
} from "../schema/spritesheet";
import { readJsoncSync, resolveDataPath, writeJsoncSync } from "../utils/jsonc";

const DEFAULT_DATA_URL = resolveDataPath(
	"../data/spritesheets.jsonc",
	import.meta.url,
);

/** Options for SpritesheetRepository operations */
export type SpritesheetRepositoryOptions = {
	/**
	 * Custom path to spritesheets.jsonc file.
	 * Images will be saved relative to this file in a 'spritesheets/' subfolder.
	 */
	dataPath?: string;
};

// Module-level variables to maintain state
let cachedData: SpritesheetsMap | null = null;
let lastDataUrl: string | null = null;
let isMocked = false;

/** Sets isolated mock data for testing */
function setData(data: SpritesheetsMap): void {
	cachedData = data;
	isMocked = true;
}

/** Resets data to original production state */
function reset(): void {
	cachedData = null;
	lastDataUrl = null;
	isMocked = false;
}

function getDataUrl(options?: SpritesheetRepositoryOptions): URL {
	if (options?.dataPath) {
		// Ensure dataPath is absolute or relative to CWD
		return new URL(`file://${options.dataPath}`);
	}
	return process.env.SPRITESHEET_DATA_URL
		? new URL(`file://${process.env.SPRITESHEET_DATA_URL}`)
		: DEFAULT_DATA_URL;
}

async function loadData(
	options?: SpritesheetRepositoryOptions,
): Promise<SpritesheetsMap> {
	if (isMocked && cachedData) return cachedData;
	const dataUrl = getDataUrl(options);
	const currentUrl = dataUrl.toString();
	if (cachedData && lastDataUrl === currentUrl) return cachedData;

	lastDataUrl = currentUrl;
	cachedData = null; // Reset cache when URL changes

	const pathString = fileURLToPath(dataUrl);
	if (!fs.existsSync(pathString)) {
		console.warn(
			`SpritesheetRepository: File not found at ${pathString}, starting empty`,
		);
		cachedData = {};
		return cachedData;
	}

	try {
		const json = readJsoncSync(dataUrl);
		cachedData = SpritesheetsMapSchema.parse(json);
		return cachedData;
	} catch (e) {
		console.error(
			`SpritesheetRepository: Critical failure loading data from ${dataUrl.toString()}`,
			e,
		);
		throw new Error(
			`Could not load spritesheet data index. Please check ${dataUrl.toString()} for JSON errors.`,
		);
	}
}

/** Returns all spritesheets grouped by character code, then by spritesheet ID */
async function getAllSpritesheets(
	options?: SpritesheetRepositoryOptions,
): Promise<SpritesheetsMap> {
	return loadData(options);
}

/** Returns all spritesheets for a specific character code */
async function getSpritesheetsByCharacterCode(
	characterCode: string,
	options?: SpritesheetRepositoryOptions,
): Promise<Spritesheet[]> {
	const data = await loadData(options);
	const characterGroup = data[characterCode.toUpperCase() as keyof typeof data];
	if (!characterGroup) {
		return [];
	}
	return Object.values(characterGroup);
}

/** Returns a spritesheet by character code and spritesheet ID */
async function getSpritesheetById(
	characterCode: string,
	spritesheetId: string,
	options?: SpritesheetRepositoryOptions,
): Promise<Spritesheet> {
	const data = await loadData(options);
	const characterGroup = data[characterCode.toUpperCase() as keyof typeof data];
	if (!characterGroup) {
		throw new Error(`No spritesheets found for character ${characterCode}`);
	}
	const spritesheet = characterGroup[spritesheetId];
	if (!spritesheet) {
		throw new Error(
			`Spritesheet with ID ${spritesheetId} not found for character ${characterCode}`,
		);
	}
	return spritesheet;
}

/** Returns spritesheets for a specific commit SHA across all characters */
async function getSpritesheetsByCommit(
	commitSha: string,
	options?: SpritesheetRepositoryOptions,
): Promise<Spritesheet[]> {
	const data = await loadData(options);
	const result: Spritesheet[] = [];
	for (const characterGroup of Object.values(data)) {
		for (const sheet of Object.values(characterGroup)) {
			if (sheet.commitSha === commitSha) {
				result.push(sheet);
			}
		}
	}
	return result;
}

/** Appends new spritesheet into spritesheets.jsonc and saves the image file */
async function addSpritesheet(
	characterCode: string,
	spritesheet: Spritesheet,
	imageData: Uint8Array,
	options?: SpritesheetRepositoryOptions,
): Promise<void> {
	const data = await loadData(options);
	const validatedSpritesheet = SpritesheetSchema.parse(spritesheet);
	const code = characterCode.toUpperCase() as keyof typeof data;

	// Initialize character group if doesn't exist
	if (!data[code]) {
		data[code] = {};
	}

	const key = validatedSpritesheet.spritesheetId;
	if (!data[code]) {
		throw new Error(`Character group ${String(code)} not found in data`);
	}
	data[code][key] = validatedSpritesheet;

	const dataUrl = getDataUrl(options);
	const dataPath = fileURLToPath(dataUrl);
	const dataDir = dataPath.substring(0, dataPath.lastIndexOf("/") + 1);
	const sheetsDir = `${dataDir}spritesheets/`;

	// Ensure directories exist
	if (!fs.existsSync(sheetsDir)) {
		fs.mkdirSync(sheetsDir, { recursive: true });
	}

	// Save image file
	const imagePath = `${sheetsDir}${validatedSpritesheet.fileName}`;
	fs.writeFileSync(imagePath, imageData);

	// Save metadata
	const header =
		"// This file is auto-generated by spritesheet-generator. Do not edit manually.";
	writeJsoncSync(dataUrl, data, header);
}

export const SpritesheetRepository = {
	setData,
	reset,
	getAllSpritesheets,
	getSpritesheetsByCharacterCode,
	getSpritesheetById,
	getSpritesheetsByCommit,
	addSpritesheet,
};
