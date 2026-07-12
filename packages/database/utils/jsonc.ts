import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CommentJSONValue } from "comment-json";
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
	// 1. Priority: process.env.FREEDOOM_DATA_DIR
	if (process.env.FREEDOOM_DATA_DIR) {
		const dataPart = relativePath.split("/data/")[1] || path.basename(relativePath);
		const absolutePath = path.resolve(process.env.FREEDOOM_DATA_DIR, dataPart);
		return pathToFileURL(absolutePath);
	}

	// 2. Fallback: try to find the data directory relative to the current working directory
	// This is useful when running bundled code in a monorepo
	const cwdDataPath = path.resolve(process.cwd(), "packages/database/data");
	if (fs.existsSync(cwdDataPath)) {
		const dataPart = relativePath.split("/data/")[1] || path.basename(relativePath);
		return pathToFileURL(path.resolve(cwdDataPath, dataPart));
	}

	// 3. Last resort: relative to importMetaUrl (works in dev)
	return new URL(relativePath, importMetaUrl);
}

/**
 * Reads a JSONC file and parses it.
 * Uses comment-json to support comments and trailing commas.
 */
export function readJsoncSync(filePath: string | URL): CommentJSONValue {
	const pathString =
		filePath instanceof URL ? fileURLToPath(filePath) : filePath;

	const content = fs.readFileSync(pathString, "utf8");
	return JSONC.parse(content);
}

/**
 * Writes data to a JSONC file.
 * Compatible with both Bun and Node.js.
 */
export function writeJsoncSync(
	filePath: string | URL,
	data: CommentJSONValue,
	header?: string,
): void {
	const pathString =
		filePath instanceof URL ? fileURLToPath(filePath) : filePath;
	const jsonString = JSONC.stringify(data, null, 2);
	const content = header ? `${header}\n${jsonString}` : jsonString;

	fs.writeFileSync(pathString, content, "utf8");
}
