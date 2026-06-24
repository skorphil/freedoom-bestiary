import { detectSource } from "./parse-sprites.ts";
import type {
  GridCell,
  GridLayout,
  SpriteEntry,
  Version,
  VersionEntry,
} from "./types.ts";

/**
 * Builds a grid layout from an array of grid cells.
 * 
 * @param cells - Array of grid cells to organize into a layout
 * @returns A GridLayout object with sorted frames and angles
 */
export function buildGridLayout(cells: GridCell[]): GridLayout {
  const frameSet = new Set<string>();
  const angleSet = new Set<number>();
  for (const c of cells) {
    frameSet.add(c.frame);
    angleSet.add(c.angle);
  }
  const frames = Array.from(frameSet).sort((a, b) => a.localeCompare(b));
  const angles = Array.from(angleSet).sort((a, b) => a - b);
  const cellsMap = new Map<string, GridCell>();
  for (const c of cells) {
    cellsMap.set(`${c.frame}_${c.angle}`, c);
  }
  return { frames, angles, cells: cellsMap };
}

/**
 * Computes the dimensions of a spritesheet based on layout and cell size.
 * 
 * @param layout - The grid layout of sprites
 * @param cellW - Width of each cell in pixels
 * @param cellH - Height of each cell in pixels
 * @returns An object containing the width and height of the spritesheet
 */
export function computeSpritesheetDimensions(
  layout: GridLayout,
  cellW: number,
  cellH: number,
): { width: number; height: number } {
  return {
    width: layout.frames.length * cellW,
    height: layout.angles.length * cellH,
  };
}

/**
 * Converts row/column indices to x/y coordinates based on cell size.
 * 
 * @param rowIndex - The row index
 * @param colIndex - The column index
 * @param cellW - Width of each cell in pixels
 * @param cellH - Height of each cell in pixels
 * @returns An object containing the x and y coordinates
 */
export function cellToPosition(
  rowIndex: number,
  colIndex: number,
  cellW: number,
  cellH: number,
): { x: number; y: number } {
  return { x: colIndex * cellW, y: rowIndex * cellH };
}

/**
 * Builds metadata for a spritesheet version entry.
 * 
 * @param version - The version information
 * @param layout - The grid layout of sprites
 * @param spritesheetPath - Path to the spritesheet file
 * @param cellW - Width of each cell in pixels
 * @param cellH - Height of each cell in pixels
 * @param paddedPaths - Map of padded cell info including original dimensions
 * @returns A VersionEntry object with spritesheet metadata
 */
export function buildSpritesheetMetadata(
  version: Version,
  layout: GridLayout,
  spritesheetPath: string,
  cellW: number,
  cellH: number,
  paddedPaths: Map<string, PaddedCell>,
): VersionEntry {
  const sprites: SpriteEntry[] = [];
  for (const frame of layout.frames) {
    for (const angle of layout.angles) {
      const key = `${frame}_${angle}`;
      const cell = layout.cells.get(key);
      const padded = paddedPaths.get(key);
      if (!cell || !padded) continue; // Skip empty sprites!
      const pos = cellToPosition(
        layout.frames.indexOf(frame),
        layout.angles.indexOf(angle),
        cellW,
        cellH,
      );
      sprites.push({
        frame,
        angle: String(angle),
        x: pos.x,
        y: pos.y,
        width: padded.w,
        height: padded.h,
        author: cell?.file.spriteAuthor,
        state: cell?.file.spriteState,
        url: cell?.file.url,
      });
    }
  }
  return {
    date: version.date,
    sha: version.sha,
    author: version.author,
    commitMessage: version.message,
    commitUrl: version.url,
    spritesheetPath,
    source: detectSource(version),
    sprites,
  };
}

/**
 * Represents a padded cell with positioning and sizing information.
 */
export interface PaddedCell {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Width in pixels */
  w: number;
  /** Height in pixels */
  h: number;
  /** Path to the image file */
  path: string;
}

/**
 * Options for creating a spritesheet.
 */
export interface CreateSpritesheetOptions {
  /** Width of each cell in pixels */
  cellW: number;
  /** Height of each cell in pixels */
  cellH: number;
  /** The grid layout of sprites */
  layout: GridLayout;
  /** Map of padded cell paths */
  paddedPaths: ReadonlyMap<string, PaddedCell>;
  /** Output path for the spritesheet */
  outputPath: string;
}

/**
 * Executes an ImageMagick command.
 * 
 * @param args - Arguments to pass to the ImageMagick command
 * @returns A promise that resolves to an object containing success status and output
 */
async function magick(
  args: string[],
): Promise<{ success: boolean; stdout: Uint8Array; stderr: Uint8Array }> {
  const cmd = new Deno.Command("magick", {
    args,
    stdout: "piped",
    stderr: "piped",
  });
  return await cmd.output();
}

/**
 * Creates a spritesheet from a grid layout using ImageMagick.
 * 
 * @param layout - The grid layout of sprites
 * @param cellW - Width of each cell in pixels
 * @param cellH - Height of each cell in pixels
 * @param outputPath - Path where the spritesheet should be saved
 * @param opts - Additional options for spritesheet creation
 * @returns A promise that resolves to an object containing the width and height of the created spritesheet
 * @throws Error if the ImageMagick command fails
 */
export async function createSpritesheet(
  layout: GridLayout,
  cellW: number,
  cellH: number,
  outputPath: string,
  opts: CreateSpritesheetOptions,
): Promise<{ w: number; h: number }> {
  const { width, height } = computeSpritesheetDimensions(
    opts.layout,
    cellW,
    cellH,
  );

  const layerArgs: string[] = ["-size", `${width}x${height}`, "xc:transparent"];
  for (const frame of opts.layout.frames) {
    for (const angle of opts.layout.angles) {
      const key = `${frame}_${angle}`;
      const cell = opts.paddedPaths.get(key);
      if (!cell) continue;
      const pos = cellToPosition(
        opts.layout.frames.indexOf(frame),
        opts.layout.angles.indexOf(angle),
        cellW,
        cellH,
      );
      layerArgs.push(
        cell.path,
        "-geometry",
        `+${pos.x}+${pos.y}`,
        "-composite",
      );
    }
  }
  layerArgs.push("-background", "none", outputPath);

  const { success, stderr } = await magick(layerArgs);
  if (!success) {
    throw new Error(
      `magick montage failed: ${new TextDecoder().decode(stderr)}`,
    );
  }
  return { w: width, h: height };
}
