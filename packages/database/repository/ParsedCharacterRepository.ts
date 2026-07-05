import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
	type ParsedCharacter,
	ParsedCharacterSchema,
	type ParsedSnapshot,
	ParsedSnapshotSchema,
} from "../schema/parsed-data";
import { readJsoncSync, resolveDataPath, writeJsoncSync } from "../utils/jsonc";

function getFileUrl(spriteCode: string): URL {
	return resolveDataPath(
		`../data/parsedCharacters/${spriteCode.toUpperCase()}.jsonc`,
		import.meta.url,
	);
}

/**
 * Gets the full parsed character history from a .jsonc file.
 * If the file doesn't exist, returns an empty ParsedCharacter structure.
 */
async function getParsedCharacter(
	spriteCode: string,
): Promise<ParsedCharacter> {
	const fileUrl = getFileUrl(spriteCode);
	const pathString = fileURLToPath(fileUrl);

	if (!fs.existsSync(pathString)) {
		return {
			code: spriteCode.toUpperCase(),
			versions: [],
		};
	}

	try {
		const parsed = readJsoncSync(fileUrl);
		return ParsedCharacterSchema.parse(parsed);
	} catch (error) {
		if (error instanceof Error && error.name === "ZodError") {
			console.error(
				`Zod validation failed for ${fileUrl}:`,
				JSON.stringify((error as Error & { errors: unknown }).errors, null, 2),
			);
		} else {
			console.error(`Failed to read or parse ${fileUrl}:`, error);
		}
		throw error;
	}
}

/**
 * Appends a new snapshot to a character's version history and saves the file.
 * Ensures the version history remains chronological based on the snapshot index.
 */
async function appendSnapshot(
	spriteCode: string,
	snapshot: ParsedSnapshot,
): Promise<void> {
	const validatedSnapshot = ParsedSnapshotSchema.parse(snapshot);
	const character = await getParsedCharacter(spriteCode);

	// Check if snapshot already exists (by SHA or index) to avoid duplicates
	const existingVersionIndex = character.versions.findIndex(
		(v) =>
			v.sha === validatedSnapshot.sha && v.index === validatedSnapshot.index,
	);

	if (existingVersionIndex !== -1) {
		// Update existing version with new data (to fix issues like name paths)
		character.versions[existingVersionIndex] = validatedSnapshot;
	} else {
		character.versions.push(validatedSnapshot);
	}

	// Sort versions by index to maintain chronological order
	character.versions.sort((a, b) => {
		const dateA = new Date(a.date).getTime();
		const dateB = new Date(b.date).getTime();
		if (dateA !== dateB) return dateA - dateB;
		return a.index - b.index;
	});

	await saveParsedCharacter(character);
}

export const ParsedCharacterRepository = {
	getParsedCharacter,
	appendSnapshot,
};

/**
 * Saves the ParsedCharacter data back to its .jsonc file.
 */
async function saveParsedCharacter(character: ParsedCharacter): Promise<void> {
	const validatedCharacter = ParsedCharacterSchema.parse(character);
	const fileUrl = getFileUrl(validatedCharacter.code);

	try {
		// Ensure directory exists
		const pathString = fileURLToPath(fileUrl);
		const dir = pathString.substring(0, pathString.lastIndexOf("/") + 1);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		writeJsoncSync(fileUrl, validatedCharacter);
	} catch (error) {
		console.error(`Failed to write ${fileUrl}:`, error);
		throw new Error(
			`Could not save parsed character data for ${validatedCharacter.code}`,
		);
	}
}
