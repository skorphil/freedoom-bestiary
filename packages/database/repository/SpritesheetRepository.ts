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

/** Reads Spritesheet data from local FS and returns typed data */
export class SpritesheetRepository {
	private static cachedData: SpritesheetsMap | null = null;
	private static lastDataUrl: string | null = null;
	private static isMocked = false;

	/** Sets isolated mock data for testing */
	static setData(data: SpritesheetsMap): void {
		SpritesheetRepository.cachedData = data;
		SpritesheetRepository.isMocked = true;
	}

	/** Resets data to original production state */
	static reset(): void {
		SpritesheetRepository.cachedData = null;
		SpritesheetRepository.lastDataUrl = null;
		SpritesheetRepository.isMocked = false;
	}

	private static getDataUrl(options?: SpritesheetRepositoryOptions): URL {
		if (options?.dataPath) {
			// Ensure dataPath is absolute or relative to CWD
			return new URL(`file://${options.dataPath}`);
		}
		return process.env.SPRITESHEET_DATA_URL
			? new URL(`file://${process.env.SPRITESHEET_DATA_URL}`)
			: DEFAULT_DATA_URL;
	}

	private static async loadData(
		options?: SpritesheetRepositoryOptions,
	): Promise<SpritesheetsMap> {
		if (SpritesheetRepository.isMocked && SpritesheetRepository.cachedData)
			return SpritesheetRepository.cachedData;
		const dataUrl = SpritesheetRepository.getDataUrl(options);
		const currentUrl = dataUrl.toString();
		if (
			SpritesheetRepository.cachedData &&
			SpritesheetRepository.lastDataUrl === currentUrl
		)
			return SpritesheetRepository.cachedData;

		SpritesheetRepository.lastDataUrl = currentUrl;
		SpritesheetRepository.cachedData = null; // Reset cache when URL changes

		const pathString = fileURLToPath(dataUrl);
		if (!fs.existsSync(pathString)) {
			console.warn(
				`SpritesheetRepository: File not found at ${pathString}, starting empty`,
			);
			SpritesheetRepository.cachedData = {};
			return SpritesheetRepository.cachedData;
		}

		try {
			const json = readJsoncSync(dataUrl);
			SpritesheetRepository.cachedData = SpritesheetsMapSchema.parse(json);
			return SpritesheetRepository.cachedData;
		} catch (e) {
			console.warn(
				"SpritesheetRepository: Failed to load data, starting empty",
				e,
			);
			SpritesheetRepository.cachedData = {};
			return SpritesheetRepository.cachedData;
		}
	}

	/** Returns all spritesheets grouped by character code, then by spritesheet ID */
	static async getAllSpritesheets(
		options?: SpritesheetRepositoryOptions,
	): Promise<SpritesheetsMap> {
		return SpritesheetRepository.loadData(options);
	}

	/** Returns all spritesheets for a specific character code */
	static async getSpritesheetsByCharacterCode(
		characterCode: string,
		options?: SpritesheetRepositoryOptions,
	): Promise<Spritesheet[]> {
		const data = await SpritesheetRepository.loadData(options);
		const characterGroup =
			data[characterCode.toUpperCase() as keyof typeof data];
		if (!characterGroup) {
			return [];
		}
		return Object.values(characterGroup);
	}

	/** Returns a spritesheet by character code and spritesheet ID */
	static async getSpritesheetById(
		characterCode: string,
		spritesheetId: string,
		options?: SpritesheetRepositoryOptions,
	): Promise<Spritesheet> {
		const data = await SpritesheetRepository.loadData(options);
		const characterGroup =
			data[characterCode.toUpperCase() as keyof typeof data];
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
	static async getSpritesheetsByCommit(
		commitSha: string,
		options?: SpritesheetRepositoryOptions,
	): Promise<Spritesheet[]> {
		const data = await SpritesheetRepository.loadData(options);
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
	static async addSpritesheet(
		characterCode: string,
		spritesheet: Spritesheet,
		imageData: Uint8Array,
		options?: SpritesheetRepositoryOptions,
	): Promise<void> {
		const data = await SpritesheetRepository.loadData(options);
		const validatedSpritesheet = SpritesheetSchema.parse(spritesheet);
		const code = characterCode.toUpperCase() as keyof typeof data;

		// Initialize character group if doesn't exist
		if (!data[code]) {
			data[code] = {};
		}

		const key = validatedSpritesheet.spritesheetId;
		data[code]![key] = validatedSpritesheet;

		const dataUrl = SpritesheetRepository.getDataUrl(options);
		const dataPath = fileURLToPath(dataUrl);
		const dataDir = dataPath.substring(0, dataPath.lastIndexOf("/") + 1);
		const sheetsDir = dataDir + "spritesheets/";

		// Ensure directories exist
		if (!fs.existsSync(sheetsDir)) {
			fs.mkdirSync(sheetsDir, { recursive: true });
		}

		// Save image file
		const imagePath = sheetsDir + validatedSpritesheet.fileName;
		fs.writeFileSync(imagePath, imageData);

		// Save metadata
		const header =
			"// This file is auto-generated by spritesheet-generator. Do not edit manually.";
		writeJsoncSync(dataUrl, data, header);
	}
}
