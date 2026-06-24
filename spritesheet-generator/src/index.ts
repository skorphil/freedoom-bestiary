import { ensureDir } from "@std/fs";
import { basename, join, resolve } from "@std/path";
import {
  buildGridLayout,
  buildSpritesheetMetadata,
  computeSpritesheetDimensions,
  type PaddedCell,
} from "./create-spritesheet.ts";
import { bareRepoMap } from "./get-image.ts";
import { loadSpriteImage } from "./get-image.ts";
import { measureImage } from "./image-size.ts";
import { ensureMirrored } from "./mirrors.ts";
import { extractGridCells } from "./parse-sprites.ts";
import type { SpritesheetCollection, Version, VersionEntry } from "./types.ts";

/**
 * Configuration for the runtime environment.
 */
export interface RuntimeConfig {
  /** Root directory of the repository */
  repoRoot: string;
  /** Directory containing version files */
  versionsDir: string;
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
    versionsDir: "./versions",
    outputDir: "./out",
    sheetDirName: "spritesheets",
    indexFileName: "spritesheets.json",
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
    try {
      Deno.statSync(join(dir, "AGENTS.md"));
      return dir;
    } catch {
      // not found at this level
    }
    try {
      Deno.statSync(join(dir, "deno.json"));
      return dir;
    } catch {
      // not found at this level
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
  const repoRoot = findRepoRoot(Deno.cwd());
  return {
    ...defaultConfig(),
    repoRoot,
    versionsDir: join(repoRoot, "historical-parser", "src", "sprite-versions"),
    outputDir: join(repoRoot, "sprite-collection"),
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
 * Reads input targets from command line arguments or default directory.
 * 
 * @param config - The runtime configuration
 * @param args - Command line arguments
 * @returns A promise that resolves to an array of InputTarget objects
 * @throws Error if the input path does not exist or is invalid
 */
export async function readInputTargets(
  config: RuntimeConfig,
  args: readonly string[],
): Promise<InputTarget[]> {
  const arg = args.find((a) => a !== "--");
  const basePath = arg ? resolve(config.repoRoot, arg) : config.versionsDir;

  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(basePath);
  } catch {
    throw new Error(`Input path ${basePath} does not exist`);
  }

  if (stat.isDirectory) {
    const targets: InputTarget[] = [];
    for await (const entry of Deno.readDir(basePath)) {
      if (!entry.isFile || !entry.name.endsWith(".json")) continue;
      const path = join(basePath, entry.name);
      const raw = await Deno.readTextFile(path);
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.spriteVersions)) {
        throw new Error(
          `Unsupported JSON format in ${path}: expected object with "spriteVersions" array`,
        );
      }
      // Map historical-parser shape -> Version shape expected by this tool
      const versions = (parsed.spriteVersions as any[])
        .map((sv) => ({
          date: sv.commitDate ?? sv.date ?? "",
          sha: sv.commitSha ?? sv.sha ?? "",
          url: sv.commitUrl ?? sv.url ?? "",
          author: sv.author ?? sv.commitAuthor ?? sv.commitSource ?? "",
          message: sv.commitMessage ?? sv.message ?? "",
          source: sv.commitSource,
          files: Array.isArray(sv.sprites)
            ? sv.sprites.map((s: any) => ({
              name: s.name,
              url: s.url,
              spriteAuthor: s.spriteAuthor,
              spriteState: s.spriteState,
            }))
            : sv.files ?? [],
        }))
      .filter((v) => {
        const hasRealChanges = v.files.some((f: any) => f.spriteState === "new" || f.spriteState === "updated");
        return hasRealChanges;
      }) as Version[];

      targets.push({ versions, code: basename(entry.name, ".json").toUpperCase(), path });
    }
    return targets;
  }

  if (stat.isFile) {
    if (!basePath.endsWith(".json")) {
      throw new Error(
        `Input path ${basePath} is not a .json file or directory`,
      );
    }
    const raw = await Deno.readTextFile(basePath);
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.spriteVersions)) {
      throw new Error(
        `Unsupported JSON format in ${basePath}: expected object with "spriteVersions" array`,
      );
    }
    const versions = (parsed.spriteVersions as any[])
      .map((sv) => ({
        date: sv.commitDate ?? sv.date ?? "",
        sha: sv.commitSha ?? sv.sha ?? "",
        url: sv.commitUrl ?? sv.url ?? "",
        author: sv.author ?? sv.commitAuthor ?? sv.commitSource ?? "",
        message: sv.commitMessage ?? sv.message ?? "",
        source: sv.commitSource,
        files: Array.isArray(sv.sprites)
          ? sv.sprites.map((s: any) => ({
            name: s.name,
            url: s.url,
            spriteAuthor: s.spriteAuthor,
            spriteState: s.spriteState,
          }))
          : sv.files ?? [],
      }))
      .filter((v) => {
      const hasRealChanges = v.files.some((f: any) => f.spriteState === "new" || f.spriteState === "updated");
      return hasRealChanges;
    }) as Version[];
    return [
      { versions, code: basename(basePath, ".json").toUpperCase(), path: basePath },
    ];
  }

  throw new Error(`Input path ${basePath} is not a directory or file`);
}

/**
 * Loads the spritesheet collection from the index file.
 * 
 * @param config - The runtime configuration
 * @returns A promise that resolves to a SpritesheetCollection object
 */
export async function loadCollection(
  config: RuntimeConfig,
): Promise<SpritesheetCollection> {
  const indexPath = join(config.outputDir, config.indexFileName);
  try {
    const raw = await Deno.readTextFile(indexPath);
    return JSON.parse(raw) as SpritesheetCollection;
  } catch {
    return {};
  }
}

/**
 * Writes the spritesheet collection to the index file.
 * 
 * @param config - The runtime configuration
 * @param collection - The spritesheet collection to write
 * @returns A promise that resolves when the collection has been written
 */
export async function writeCollection(
  config: RuntimeConfig,
  collection: SpritesheetCollection,
): Promise<void> {
  await ensureDir(config.outputDir);
  const indexPath = join(config.outputDir, config.indexFileName);
  const tmpPath = `${indexPath}.tmp`;
  await Deno.writeTextFile(tmpPath, JSON.stringify(collection, null, 2));
  await Deno.rename(tmpPath, indexPath);
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
 * Executes an ImageMagick command.
 * 
 * @param args - Arguments to pass to the ImageMagick command
 * @returns A promise that resolves when the command completes
 * @throws Error if the ImageMagick command fails
 */
async function runMagick(args: string[]): Promise<void> {
  const cmd = new Deno.Command("magick", {
    args,
    stdout: "piped",
    stderr: "piped",
  });
  const { success, stderr } = await cmd.output();
  if (!success) {
    throw new Error(
      `magick ${args[0]} failed: ${new TextDecoder().decode(stderr)}`,
    );
  }
}

/**
 * Ensures an image is padded to the specified dimensions.
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
  
  try {
    await Deno.stat(outPath);
    return outPath;
  } catch {
    // not yet on disk
  }
  
  try {
    // We always want to process the image to ensure transparency is applied
    // even if dimensions already match. We use [0] for multi-frame images.
    const framePath = `${sourcePath}[0]`;
    await runMagick([
      framePath,
      "-fuzz",
      "5%",
      "-transparent",
      "#01ffff", // Target the correct cyan background
      "-background",
      "none",
      "-gravity",
      "NorthWest",
      "-extent",
      `${cellW}x${cellH}`,
      outPath,
    ]);
  } catch (error) {
    // Check if ImageMagick created files with numeric suffixes (can happen with some formats)
    const dir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
    const fileName = sourcePath.substring(sourcePath.lastIndexOf('/') + 1);
    
    try {
      // Look for files with numeric suffixes
      const pattern = `${fileName}.processed-*.png`;
      const cmd = new Deno.Command("bash", {
        args: ["-c", `ls ${dir}/${pattern} 2>/dev/null | head -1`],
        stdout: "piped",
        stderr: "piped",
      });
      const { success, stdout } = await cmd.output();
      if (success) {
        const outputFile = new TextDecoder().decode(stdout).trim();
        if (outputFile.length > 0) {
          const data = await Deno.readFile(outputFile);
          await Deno.writeFile(outPath, data);
          return outPath;
        }
      }
    } catch (_lsError) {
      // Ignore ls errors
    }
    
    // If ImageMagick fails, create a simple fallback image
    console.warn(`Failed to process image ${sourcePath}, creating fallback: ${(error as Error).message}`);
    // Create a simple 1x1 transparent PNG as fallback
    const fallbackPng = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACdFJOUwAAdpPNOAAAAAJiS0dEAAHdihOkAAAAB3RJTUUH6gYXDjgtYVvFRgAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyNi0wNi0yM1QxNDo1Njo0NSswMDowMOnIZewAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjYtMDYtMjNUMTQ6NTY6NDUrMDA6MDCYld1QAAAAKHRFWHRkYXRlOnRpbWVzdGFtcAAyMDI2LTA2LTIzVDE0OjU2OjQ1KzAwOjAwz4D8jwAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    await Deno.writeFile(outPath, fallbackPng);
  }
  return outPath;
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
  await ensureDir(cacheShaDir);

  const fileJobs = version.files.map(async (file) => {
    const baseName = file.name;
    const cachedPath = join(cacheShaDir, baseName);
    try {
      await Deno.stat(cachedPath);
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
        await ensureDir(cachedPath.substring(0, cachedPath.lastIndexOf('/')));
      } catch {
        // ignore
      }
      await Deno.writeFile(cachedPath, image.data);
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
 * @returns A promise that resolves to a VersionEntry or null if no spritesheet was created
 */
export async function buildOneSheet(
  config: RuntimeConfig,
  code: string,
  version: Version,
): Promise<VersionEntry | null> {
  const result = await fetchAndMeasureVersion(config, code, version);
  if (!result) return null;
  const { layout, cellW, cellH, padded } = result;
  if (cellW === 0 || cellH === 0) return null;

  const { width, height } = computeSpritesheetDimensions(layout, cellW, cellH);
  if (width === 0 || height === 0) return null;

  const sheetDir = join(config.outputDir, config.sheetDirName, code);
  await ensureDir(sheetDir);
  const shortSha = version.sha.slice(0, 7);
  const outPath = join(sheetDir, `${shortSha}.webp`);

  const layerArgs: string[] = ["-size", `${width}x${height}`, "xc:transparent"];
  for (const frame of layout.frames) {
    for (const angle of layout.angles) {
      const key = `${frame}_${angle}`;
      const cell = padded.get(key);
      if (!cell) continue;
      const x = layout.frames.indexOf(frame) * cellW;
      const y = layout.angles.indexOf(angle) * cellH;
      layerArgs.push(cell.path, "-geometry", `+${x}+${y}`, "-composite");
    }
  }
  layerArgs.push(
    "-background",
    "none",
    "-define",
    "webp:lossless=true",
    outPath,
  );
  await runMagick(layerArgs);

  const relPath = join(config.sheetDirName, code, `${shortSha}.webp`);
  return buildSpritesheetMetadata(
    version,
    layout,
    relPath,
    cellW,
    cellH,
    padded,
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
): Promise<{ collection: SpritesheetCollection; appended: number }> {
  const collection = await loadCollection(config);
  let appended = 0;

  for (const target of targets) {
    for (const version of target.versions) {
      const code = target.code;
      const existing = collection[code] ?? [];
      if (existing.some((e) => e.sha === version.sha)) continue;

      console.log(`[${code} @ ${version.sha.slice(0, 7)}] building...`);
      // Force regeneration by deleting existing entry in index if we are here (manual override mode or bug fix run)
      // collection[code] = existing.filter(e => e.sha !== version.sha);
      
      const entry = await buildOneSheet(config, code, version);

      if (!entry) {
        console.warn(
          `[${code} @ ${version.sha.slice(0, 7)}] no frames, skipping`,
        );
        continue;
      }

      if (!collection[code]) collection[code] = [];
      collection[code].push(entry);
      appended++;
    }
  }

  if (appended > 0) await writeCollection(config, collection);
  return { collection, appended };
}

/**
 * Main entry point for the spritesheet generator.
 * 
 * @returns A promise that resolves when the process is complete
 */
export async function main() {
  const config = resolveConfig();
  const args = Deno.args;
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
