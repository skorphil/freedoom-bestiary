import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  buildGridLayout,
  buildSpritesheetMetadata,
  computeSpritesheetDimensions,
  createSpritesheet,
  type PaddedCell,
} from "./create-spritesheet.ts";
import { bareRepoMap } from "./get-image.ts";
import { loadSpriteImage } from "./get-image.ts";
import { measureImage } from "./image-size.ts";
import { ensureMirrored } from "./mirrors.ts";
import { extractGridCells } from "./parse-sprites.ts";
import type { Spritesheet, SpritesheetsMap, Version } from "./types.ts";
import sharp from "sharp";
import { CharacterRepository, ParsedCharacterRepository, SpritesheetRepository } from "@freedoom-bestiary/database";

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
export function findRepoRoot(start: string): string {
  let dir = start;
  while (true) {
    // Check for workspace root by looking for the packages directory
    if (existsSync(join(dir, "packages")) && existsSync(join(dir, "package.json"))) {
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
export function resolveConfig(): RuntimeConfig {
  const repoRoot = findRepoRoot(process.cwd());
  const resolvedOutputDir = resolve(repoRoot, "packages", "database", "data");
  
  console.log(`[Config] repoRoot: ${repoRoot}`);
  console.log(`[Config] outputDir: ${resolvedOutputDir}`);

  return {
    ...defaultConfig(),
    repoRoot,
    outputDir: resolvedOutputDir,
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
      const parsedCharacter = ParsedCharacterRepository.getParsedCharacter(code);
      
      // Map ParsedCharacter to InputTarget format
      const versions: Version[] = parsedCharacter.versions.map(snapshot => ({
        date: snapshot.date,
        sha: snapshot.sha,
        index: snapshot.index,
        url: snapshot.url,
        authors: snapshot.contributions,
        message: snapshot.message,
        source: snapshot.source,
        files: snapshot.sprites.map(sprite => ({
          name: sprite.name,
          url: sprite.url,
          spriteAuthors: sprite.contributions,
          spriteState: sprite.state,
        })),
      }));
      
      targets.push({
        versions,
        code: parsedCharacter.code,
        path: `database:${parsedCharacter.code}`
      });
    }
    
    return targets;
  }

  // If no arguments provided, fetch all characters
  const allCharacters = CharacterRepository.getAllCharacters();
  const allCharacterCodes = Object.keys(allCharacters);
  
  const targets: InputTarget[] = [];
  
  for (const code of allCharacterCodes) {
    const parsedCharacter = ParsedCharacterRepository.getParsedCharacter(code);
    
    // Map ParsedCharacter to InputTarget format
    const versions: Version[] = parsedCharacter.versions.map(snapshot => ({
      date: snapshot.date,
      sha: snapshot.sha,
      index: snapshot.index,
      url: snapshot.url,
      authors: snapshot.contributions,
      message: snapshot.message,
      source: snapshot.source,
      files: snapshot.sprites.map(sprite => ({
        name: sprite.name,
        url: sprite.url,
        spriteAuthors: sprite.contributions,
        spriteState: sprite.state,
      })),
    }));
    
    targets.push({
      versions,
      code: parsedCharacter.code,
      path: `database:${parsedCharacter.code}`
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
 * Ensures an image is padded to the specified dimensions and has transparency.
 * 
 * @param sourcePath - Path to the source image
 * @param cellW - Target width in pixels
 * @param cellH - Target height in pixels
 * @returns A promise that resolves to the path of the padded image
 */
async function ensurePadded(
  sourcePath: string,
  cellW: number,
  cellH: number,
): Promise<string> {
  const outPath = `${sourcePath}.processed.png`;
  
  if (existsSync(outPath)) {
    return outPath;
  }
  
  try {
    const image = sharp(sourcePath);
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    
    // Process transparency for cyan background (#01ffff)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      // Match #01ffff with approx 5% fuzz
      if (r <= 15 && g >= 240 && b >= 240) {
        data[i+3] = 0;
      }
    }
    
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extend({
        top: 0,
        left: 0,
        bottom: Math.max(0, cellH - info.height),
        right: Math.max(0, cellW - info.width),
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outPath);
      
    return outPath;
  } catch (error) {
    console.warn(`Failed to process image ${sourcePath}, creating fallback: ${(error as Error).message}`);
    const fallbackPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACdFJOUwAAdpPNOAAAAAJiS0dEAAHdihOkAAAAB3RJTUUH6gYXDjgtYVvFRgAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyNi0wNi0yM1QxNDo1Njo0NSswMDowMOnIZewAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjYtMDYtMjNUMTQ6NTY6NDUrMDA6MDCYld1QAAAAKHRFWHRkYXRlOnRpbWVzdGFtcAAyMDI2LTA2LTIzVDE0OjU2OjQ1KzAwOjAwz4D8jwAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=",
      "base64"
    );
    await writeFile(outPath, fallbackPng);
    return outPath;
  }
}

/**
 * Fetches and measures a version of sprites.
 * 
 * @param config - The runtime configuration
 * @param code - The sprite code to process
 * @param version - The version to process
 * @returns A promise that resolves to an object containing layout, dimensions, and padded cells, or null if no cells exist
 */
async function fetchAndMeasureVersion(
  config: RuntimeConfig,
  code: string,
  version: Version,
): Promise<
  {
    layout: ReturnType<typeof buildGridLayout>;
    cellW: number;
    cellH: number;
    padded: Map<string, PaddedCell>;
  } | null
> {
  const cells = extractGridCells(version.files, code);
  if (cells.length === 0) return null;
  const layout = buildGridLayout(cells);

  const cacheShaDir = join(config.outputDir, config.cacheDirName, version.sha);
  await mkdir(cacheShaDir, { recursive: true });

  const fileJobs = version.files.map(async (file) => {
    const baseName = file.name;
    const cachedPath = join(cacheShaDir, baseName);
    try {
      await stat(cachedPath);
    } catch {
      const image = await loadSpriteImage(file.url, {
        "freedoom/freedoom": config.bareRepos["freedoom/freedoom"] ?? "",
        "freedoom/attic": config.bareRepos["freedoom/attic"] ?? "",
      });
      if (!image) {
        console.warn(`Skipping sprite ${file.name}: failed to download or not an image (${file.url})`);
        return null; // signal that this file couldn't be fetched
      }
      // Ensure parent directory exists (file.name may include subdirectories)
      try {
        await mkdir(cachedPath.substring(0, cachedPath.lastIndexOf('/')), { recursive: true });
      } catch {
        // ignore
      }
      await writeFile(cachedPath, image.data);
    }
    return { file, cachedPath };
  });
  const chunked = chunk(fileJobs, config.fetchConcurrency);
  const resolvedFiles: {
    file: (typeof version.files)[number];
    cachedPath: string;
  }[] = [];
  for (const c of chunked) {
    const part = (await Promise.all(c)) as (typeof resolvedFiles[number] | null)[];
    for (const p of part) {
      if (p) resolvedFiles.push(p);
    }
  }

  const seen = new Set<string>();
  const padded = new Map<string, PaddedCell>();
  let cellW = 0;
  let cellH = 0;
  for (const { file, cachedPath } of resolvedFiles) {
    if (seen.has(cachedPath)) continue;
    seen.add(cachedPath);

    const mirrored = await ensureMirrored(cachedPath);
    const originalSize = await measureImage(mirrored.originalPath);
    const mirrorSize = await measureImage(mirrored.mirrorPath);
    cellW = Math.max(cellW, originalSize.w, mirrorSize.w);
    cellH = Math.max(cellH, originalSize.h, mirrorSize.h);

    for (const cell of cells) {
      if (cell.file !== file) continue;
      const key = `${cell.frame}_${cell.angle}`;
      padded.set(key, {
        x: 0,
        y: 0,
        w: cell.mirror ? mirrorSize.w : originalSize.w,
        h: cell.mirror ? mirrorSize.h : originalSize.h,
        path: cell.mirror ? mirrored.mirrorPath : mirrored.originalPath,
      });
    }
  }

  // Deduplicate paths to avoid multiple calls to ensurePadded for the same file
  const pathToPaddedPath = new Map<string, string>();
  for (const cell of Array.from(padded.values())) {
    if (!pathToPaddedPath.has(cell.path)) {
      const paddedPath = await ensurePadded(cell.path, cellW, cellH);
      pathToPaddedPath.set(cell.path, paddedPath);
    }
    cell.path = pathToPaddedPath.get(cell.path)!;
  }

  return { layout, cellW, cellH, padded };
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
  const { layout, cellW, cellH, padded } = result;
  if (cellW === 0 || cellH === 0) return null;

  const { width, height } = computeSpritesheetDimensions(layout, cellW, cellH);
  if (width === 0 || height === 0) return null;

  const spritesheetId = crypto.randomUUID();
  const fileName = `${code.toLowerCase()}.${version.sha}.${spritesheetId}.webp`;
  const sheetDir = join(config.outputDir, config.sheetDirName);
  await mkdir(sheetDir, { recursive: true });
  const outPath = join(sheetDir, fileName);

  await createSpritesheet(layout, cellW, cellH, outPath, {
    layout,
    cellW,
    cellH,
    paddedPaths: padded,
    outputPath: outPath,
  });

  const relPath = join(config.sheetDirName, fileName);
  return buildSpritesheetMetadata(
    version,
    layout,
    relPath,
    cellW,
    cellH,
    padded,
    code,
    spritesheetId,
  );
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
  const collection = SpritesheetRepository.getAllSpritesheets();
  let appended = 0;

  for (const target of targets) {
    const code = target.code;
    for (const version of target.versions) {
      console.log(`[${code} @ ${version.sha.slice(0, 7)}] building...`);
      const entry = await buildOneSheet(config, code, version);

      if (!entry) {
        console.warn(
          `[${code} @ ${version.sha.slice(0, 7)}] no frames, skipping`,
        );
        continue;
      }

      SpritesheetRepository.addSpritesheet(code, entry);
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
  const config = resolveConfig();
  const args = Bun.argv.slice(2);
  const targets = await readInputTargets(config, args);
  const { appended } = await runWithConfig(config, targets);
  if (appended > 0) {
    console.log(`Wrote index with ${appended} new entries.`);
  } else {
    console.log("No new entries to write.");
  }
}

if (import.meta.main || (typeof process !== "undefined" && process.argv[1] === Bun.main)) {
  await main();
}
