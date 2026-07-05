import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as JSONC from "comment-json";

/**
 * Resolves the path to a data file.
 * Priority:
 * 1. process.env.FREEDOOM_DATA_DIR (if set, joined with relativePath)
 * 2. Fallback to resolution relative to the provided importMetaUrl
 */
export function resolveDataPath(
	relativePath: string,
	importMetaUrl: string,
): URL {
	if (process.env.FREEDOOM_DATA_DIR) {
		// relativePath is usually something like "../data/characters.jsonc"
		// We want the filename part if FREEDOOM_DATA_DIR is provided
		const filename = path.basename(relativePath);
		const absolutePath = path.resolve(process.env.FREEDOOM_DATA_DIR, filename);
		return pathToFileURL(absolutePath);
	}
	return new URL(relativePath, importMetaUrl);
}

/**
 * Reads a JSONC file and parses it.
 * Uses Bun's native JSONC support if available, otherwise falls back to comment-json.
 */
export function readJsoncSync(filePath: string | URL): any {
	const pathString =
		filePath instanceof URL ? fileURLToPath(filePath) : filePath;

	if (typeof Bun !== "undefined") {
		// In Bun, we can read the file and JSON.parse handles JSONC
		const content = fs.readFileSync(pathString, "utf8");
		return JSON.parse(content);
	} else {
		// In Node.js, we use comment-json
		const content = fs.readFileSync(pathString, "utf8");
		return JSONC.parse(content);
	}
}

/**
 * Writes data to a JSONC file.
 * Compatible with both Bun and Node.js.
 */
export function writeJsoncSync(
	filePath: string | URL,
	data: any,
	header?: string,
): void {
	const pathString =
		filePath instanceof URL ? fileURLToPath(filePath) : filePath;
	const jsonString = JSONC.stringify(data, null, 2);
	const content = header ? `${header}\n${jsonString}` : jsonString;

	fs.writeFileSync(pathString, content, "utf8");
}
