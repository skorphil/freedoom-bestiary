import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
	buildGridLayout,
	buildSpritesheetMetadata,
	computeSpritesheetDimensions,
	createSpritesheetBuffer,
	type PaddedCell,
} from "./create-spritesheet.ts";
import { bareRepoMap } from "./get-image.ts";
import { loadSpriteImage } from "./get-image.ts";
import { extractGridCells } from "./parse-sprites.ts";
import type { Spritesheet, SpritesheetsMap, Version } from "./types.ts";
import sharp from "sharp";
import {
	CharacterRepository,
	ParsedCharacterRepository,
	SpritesheetRepository,
	type CharacterCode,
	type SpritesheetRepositoryOptions,
} from "@freedoom-bestiary/database";

/**
 * Configuration for the runtime environment.
 */
export interface RuntimeConfig {
	/** Root directory of the repository */
	repoRoot: string;
	/** Output directory for generated files */
	outputDir: string;
	/** Name of the spritesheets directory */
	sheetDirName: string;
	/** Name of the index file */
	indexFileName: string;
	/** Name of the cache directory */
	cacheDirName: string;
	/** Map of repository names to their local paths */
	bareRepos: Readonly<Record<string, string>>;
	/** Maximum number of concurrent fetch operations */
	fetchConcurrency: number;
	/** Options for the database repository */
	repositoryOptions?: SpritesheetRepositoryOptions;
}

/**
 * Creates a default runtime configuration.
 *
 * @returns A RuntimeConfig object with default values
 */
export function defaultConfig(): RuntimeConfig {
	return {
		repoRoot: ".",
		outputDir: "./out",
		sheetDirName: "spritesheets",
		indexFileName: "spritesheets.jsonc",
		cacheDirName: ".cache",
		bareRepos: {},
		fetchConcurrency: 8,
	};
}

/**
 * Finds the repository root directory by looking for specific marker files.
 *
 * @param start - The directory to start searching from
 * @returns The path to the repository root
 */
export async function findRepoRoot(start: string): string {
	let dir = start;
	while (true) {
		// Check for workspace root by looking for the packages directory
		const packagesExists = await Bun.file(join(dir, "packages")).exists();
		const packageJsonExists = await Bun.file(
			join(dir, "package.json"),
		).exists();
		if (packagesExists && packageJsonExists) {
			return dir;
		}
		const parent = join(dir, "..");
		if (parent === dir) break;
		dir = parent;
	}
	return start;
}

/**
 * Resolves the runtime configuration based on the current working directory.
 *
 * @returns A RuntimeConfig object with resolved paths
 */
export async function resolveConfig(): Promise<RuntimeConfig> {
	const repoRoot = await findRepoRoot(process.cwd());

	return {
		...defaultConfig(),
		repoRoot,
		outputDir: "", // No longer used for images
		sheetDirName: "spritesheets",
		indexFileName: "spritesheets.jsonc",
		bareRepos: bareRepoMap(repoRoot),
	};
}

/**
 * Represents an input target for processing.
 */
export interface InputTarget {
	/** Array of versions to process */
	versions: Version[];
	/** Sprite code (e.g., "POSS") */
	code: string;
	/** Path to the source file */
	path: string;
}

/**
 * Reads input targets from command line arguments or all available characters.
 *
 * @param _config - The runtime configuration (unused in new implementation)
 * @param args - Command line arguments (sprite codes like "POSS")
 * @returns A promise that resolves to an array of InputTarget objects
 */
export async function readInputTargets(
	_config: RuntimeConfig,
	args: readonly string[],
): Promise<InputTarget[]> {
	// Filter out any "--" arguments
	const spriteCodes = args.filter((a) => a !== "--");

	// If specific sprite codes are provided, fetch those
	if (spriteCodes.length > 0) {
		const targets: InputTarget[] = [];

		for (const code of spriteCodes) {
			const parsedCharacter =
				await ParsedCharacterRepository.getParsedCharacter(code);

			// Map ParsedCharacter to InputTarget format
			const versions: Version[] = parsedCharacter.versions.map((snapshot) => ({
				date: snapshot.date,
				sha: snapshot.sha,
				index: snapshot.index,
				url: snapshot.url,
				authors: snapshot.contributions,
				message: snapshot.message,
				source: snapshot.source,
				files: snapshot.sprites.map((sprite) => ({
					name: sprite.name,
					url: sprite.url,
					spriteAuthors: sprite.contributions,
					spriteState: sprite.state,
				})),
			}));

			targets.push({
				versions,
				code: parsedCharacter.code,
				path: `database:${parsedCharacter.code}`,
			});
		}

		return targets;
	}

	// If no arguments provided, fetch all characters
	const allCharacters = CharacterRepository.getAllCharacters();
	const allCharacterCodes = Object.keys(allCharacters);

	const targets: InputTarget[] = [];

	for (const code of allCharacterCodes) {
		const parsedCharacter =
			await ParsedCharacterRepository.getParsedCharacter(code);

		// Map ParsedCharacter to InputTarget format
		const versions: Version[] = parsedCharacter.versions.map((snapshot) => ({
			date: snapshot.date,
			sha: snapshot.sha,
			index: snapshot.index,
			url: snapshot.url,
			authors: snapshot.contributions,
			message: snapshot.message,
			source: snapshot.source,
			files: snapshot.sprites.map((sprite) => ({
				name: sprite.name,
				url: sprite.url,
				spriteAuthors: sprite.contributions,
				spriteState: sprite.state,
			})),
		}));

		targets.push({
			versions,
			code: parsedCharacter.code,
			path: `database:${parsedCharacter.code}`,
		});
	}

	return targets;
}

/**
 * Splits an array into chunks of a specified size.
 *
 * @param arr - The array to chunk
 * @param size - The size of each chunk
 * @returns An array of chunked arrays
 */
export function chunk<T>(arr: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		out.push(arr.slice(i, i + size));
	}
	return out;
}

/**
 * Processes an image buffer to apply alpha channel and cyan transparency fix.
 *
 * @param imageBuffer - The image buffer to process
 * @param cellW - Target width in pixels
 * @param cellH - Target height in pixels
 * @returns A promise that resolves to the processed image buffer and its dimensions
 */
async function processImageBuffer(
	imageBuffer: Buffer,
	cellW: number,
	cellH: number,
): Promise<{ buffer: Buffer; width: number; height: number }> {
	try {
		const image = sharp(imageBuffer);
		const { data, info } = await image
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		// Process transparency for cyan background (#01ffff)
		for (let i = 0; i < data.length; i += 4) {
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];

			// Match #01ffff with approx 5% fuzz
			if (r <= 15 && g >= 240 && b >= 240) {
				data[i + 3] = 0;
			}
		}

		const processedBuffer = await sharp(data, {
			raw: { width: info.width, height: info.height, channels: 4 },
		})
			.extend({
				top: 0,
				left: 0,
				bottom: Math.max(0, cellH - info.height),
				right: Math.max(0, cellW - info.width),
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.png()
			.toBuffer();

		return {
			buffer: processedBuffer,
			width: Math.max(info.width, cellW),
			height: Math.max(info.height, cellH),
		};
	} catch (error) {
		console.warn(
			`Failed to process image buffer, creating fallback: ${(error as Error).message}`,
		);
		const fallbackPng = Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACdFJOUwAAdpPNOAAAAAJiS0dEAAHdihOkAAAAB3RJTUUH6gYXDjgtYVvFRgAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyNi0wNi0yM1QxNDo1Njo0NSswMDowMOnIZewAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjYtMDYtMjNUMTQ6NTY6NDUrMDA6MDCYld1QAAAAKHRFWHRkYXRlOnRpbWVzdGFtcAAyMDI2LTA2LTIzVDE0OjU2OjQ1KzAwOjAwz4D8jwAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=",
			"base64",
		);

		// Create a properly sized fallback image
		const fallbackBuffer = await sharp(fallbackPng)
			.resize(cellW, cellH, {
				fit: "contain",
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.png()
			.toBuffer();

		return {
			buffer: fallbackBuffer,
			width: cellW,
			height: cellH,
		};
	}
}

/**
 * Represents a processed image with its buffer and dimensions.
 */
interface ProcessedImage {
	/** The processed image buffer */
	buffer: Buffer;
	/** Width of the image in pixels */
	width: number;
	/** Height of the image in pixels */
	height: number;
}

/**
 * Fetches and measures a version of sprites using in-memory processing.
 *
 * @param config - The runtime configuration
 * @param code - The sprite code to process
 * @param version - The version to process
 * @returns A promise that resolves to an object containing layout, dimensions, and processed cells, or null if no cells exist
 */
async function fetchAndMeasureVersion(
	config: RuntimeConfig,
	code: string,
	version: Version,
): Promise<{
	layout: ReturnType<typeof buildGridLayout>;
	cellW: number;
	cellH: number;
	processed: Map<string, { cell: PaddedCell; buffer: Buffer }>;
} | null> {
	const cells = extractGridCells(version.files, code);
	if (cells.length === 0) return null;
	const layout = buildGridLayout(cells);

	// Cache for processed base images to avoid reprocessing the same image for multiple versions
	const imageBufferCache = new Map<string, ProcessedImage>();
	// Cache for mirrored images
	const mirroredBufferCache = new Map<string, Buffer>();

	const fileJobs = version.files.map(async (file) => {
		const image = await loadSpriteImage(file.url, {
			"freedoom/freedoom": config.bareRepos["freedoom/freedoom"] ?? "",
			"freedoom/attic": config.bareRepos["freedoom/attic"] ?? "",
		});
		if (!image) {
			console.warn(
				`Skipping sprite ${file.name}: failed to download or not an image (${file.url})`,
			);
			return null; // signal that this file couldn't be fetched
		}
		return { file, imageData: image.data };
	});

	const chunked = chunk(fileJobs, config.fetchConcurrency);
	const resolvedFiles: {
		file: (typeof version.files)[number];
		imageData: Uint8Array;
	}[] = [];

	for (const c of chunked) {
		const part = (await Promise.all(c)) as (
			| (typeof resolvedFiles)[number]
			| null
		)[];
		for (const p of part) {
			if (p) resolvedFiles.push(p);
		}
	}

	const processed = new Map<string, { cell: PaddedCell; buffer: Buffer }>();
	let cellW = 0;
	let cellH = 0;

	for (const { file, imageData } of resolvedFiles) {
		// Convert Uint8Array to Buffer for Sharp
		const imageBuffer = Buffer.from(imageData);

		// Process the original image if not already cached
		let processedImage: ProcessedImage;
		const cacheKey = `${file.url}_original`;
		if (imageBufferCache.has(cacheKey)) {
			processedImage = imageBufferCache.get(cacheKey)!;
		} else {
			// Process the image with alpha channel and padding
			processedImage = await processImageBuffer(imageBuffer, 0, 0); // Will determine max dimensions later
			imageBufferCache.set(cacheKey, processedImage);
		}

		// Process the mirrored image if needed
		let mirroredBuffer: Buffer | null = null;
		const needsMirror = cells.some((cell) => cell.file === file && cell.mirror);
		if (needsMirror) {
			const mirrorCacheKey = `${file.url}_mirror`;
			if (mirroredBufferCache.has(mirrorCacheKey)) {
				mirroredBuffer = mirroredBufferCache.get(mirrorCacheKey)!;
			} else {
				try {
					mirroredBuffer = await sharp(imageBuffer)
						.ensureAlpha()
						.flop() // Horizontal flip
						.toBuffer();

					// Apply the same transparency processing to the mirrored image
					const { data, info } = await sharp(mirroredBuffer)
						.ensureAlpha()
						.raw()
						.toBuffer({ resolveWithObject: true });

					// Process transparency for cyan background (#01ffff)
					for (let i = 0; i < data.length; i += 4) {
						const r = data[i];
						const g = data[i + 1];
						const b = data[i + 2];

						// Match #01ffff with approx 5% fuzz
						if (r <= 15 && g >= 240 && b >= 240) {
							data[i + 3] = 0;
						}
					}

					mirroredBuffer = await sharp(data, {
						raw: { width: info.width, height: info.height, channels: 4 },
					})
						.png()
						.toBuffer();

					mirroredBufferCache.set(mirrorCacheKey, mirroredBuffer);
				} catch (error) {
					console.warn(
						`Failed to create mirror for ${file.name}, using original: ${(error as Error).message}`,
					);
					mirroredBuffer = imageBuffer;
				}
			}
		}

		// Update max dimensions
		const originalMetadata = await sharp(processedImage.buffer).metadata();
		const mirrorMetadata = mirroredBuffer
			? await sharp(mirroredBuffer).metadata()
			: null;

		cellW = Math.max(
			cellW,
			originalMetadata.width ?? 0,
			mirrorMetadata?.width ?? 0,
		);
		cellH = Math.max(
			cellH,
			originalMetadata.height ?? 0,
			mirrorMetadata?.height ?? 0,
		);

		// Associate processed images with cells
		for (const cell of cells) {
			if (cell.file !== file) continue;
			const key = `${cell.frame}_${cell.angle}`;

			if (cell.mirror && mirroredBuffer) {
				// For mirrored cells, use the mirrored buffer directly
				const metadata = await sharp(mirroredBuffer).metadata();
				processed.set(key, {
					cell: {
						x: 0,
						y: 0,
						w: metadata.width ?? 0,
						h: metadata.height ?? 0,
						path: "", // Not used anymore since we pass buffers directly
					},
					buffer: mirroredBuffer,
				});
			} else {
				// For original cells, process with final dimensions
				const finalProcessedImage = await processImageBuffer(
					imageBuffer,
					cellW,
					cellH,
				);
				processed.set(key, {
					cell: {
						x: 0,
						y: 0,
						w: finalProcessedImage.width,
						h: finalProcessedImage.height,
						path: "", // Not used anymore since we pass buffers directly
					},
					buffer: finalProcessedImage.buffer,
				});
			}
		}
	}

	// Final pass to ensure all images are padded to the same dimensions
	for (const [key, item] of processed) {
		if (item.cell.w < cellW || item.cell.h < cellH) {
			const paddedBuffer = await sharp(item.buffer)
				.extend({
					top: 0,
					left: 0,
					bottom: Math.max(0, cellH - item.cell.h),
					right: Math.max(0, cellW - item.cell.w),
					background: { r: 0, g: 0, b: 0, alpha: 0 },
				})
				.png()
				.toBuffer();

			processed.set(key, {
				cell: {
					...item.cell,
					w: Math.max(item.cell.w, cellW),
					h: Math.max(item.cell.h, cellH),
				},
				buffer: paddedBuffer,
			});
		}
	}

	return { layout, cellW, cellH, processed };
}

/**
 * Builds a spritesheet for a specific version.
 *
 * @param config - The runtime configuration
 * @param code - The sprite code to process
 * @param version - The version to process
 * @returns A promise that resolves to a Spritesheet or null if no spritesheet was created
 */
export async function buildOneSheet(
	config: RuntimeConfig,
	code: string,
	version: Version,
): Promise<Spritesheet | null> {
	const result = await fetchAndMeasureVersion(config, code, version);
	if (!result) return null;
	const { layout, cellW, cellH, processed } = result;
	if (cellW === 0 || cellH === 0) return null;

	const { width, height } = computeSpritesheetDimensions(layout, cellW, cellH);
	if (width === 0 || height === 0) return null;

	// Convert processed map to padded paths map for compatibility with createSpritesheet
	const paddedPaths = new Map<string, PaddedCell>();
	for (const [key, item] of processed) {
		paddedPaths.set(key, { ...item.cell, buffer: item.buffer });
	}

	const { buffer, w, h } = await createSpritesheetBuffer(layout, cellW, cellH, {
		layout,
		cellW,
		cellH,
		paddedPaths,
		outputPath: "", // Not used
		processedImages: processed, // Pass the processed images directly
	});

	const spritesheetId = crypto.randomUUID();
	const relPath = join(
		config.sheetDirName,
		`${code.toLowerCase()}.${version.sha}.${spritesheetId}.webp`,
	);

	const entry = buildSpritesheetMetadata(
		version,
		layout,
		relPath,
		cellW,
		cellH,
		paddedPaths,
		code,
		spritesheetId,
	);

	await SpritesheetRepository.addSpritesheet(
		code,
		entry,
		buffer,
		config.repositoryOptions,
	);
	return entry;
}

/**
 * Runs the spritesheet generator with the provided configuration and targets.
 *
 * @param config - The runtime configuration
 * @param targets - The input targets to process
 * @returns A promise that resolves to an object containing the collection and number of appended entries
 */
export async function runWithConfig(
	config: RuntimeConfig,
	targets: InputTarget[],
): Promise<{ collection: SpritesheetsMap; appended: number }> {
	const collection = await SpritesheetRepository.getAllSpritesheets(
		config.repositoryOptions,
	);
	let appended = 0;

	for (const target of targets) {
		const code = target.code as CharacterCode;
		const characterGroup = collection[code];

		for (const version of target.versions) {
			// Skip if this SHA is already in the collection for this character
			if (
				characterGroup &&
				Object.values(characterGroup).some((s) => s.commitSha === version.sha)
			) {
				continue;
			}

			console.log(`[${code} @ ${version.sha.slice(0, 7)}] building...`);
			const entry = await buildOneSheet(config, code, version);

			if (!entry) {
				console.warn(
					`[${code} @ ${version.sha.slice(0, 7)}] no frames, skipping`,
				);
				continue;
			}

			appended++;
		}
	}

	return { collection, appended };
}

/**
 * Main entry point for the spritesheet generator.
 *
 * @returns A promise that resolves when the process is complete
 */
export async function main() {
	const config = await resolveConfig();
	const args = Bun.argv.slice(2);
	const targets = await readInputTargets(config, args);
	const { appended } = await runWithConfig(config, targets);
	if (appended > 0) {
		console.log(`Wrote index with ${appended} new entries.`);
	} else {
		console.log("No new entries to write.");
	}
}

if (import.meta.main) {
	await main();
}
