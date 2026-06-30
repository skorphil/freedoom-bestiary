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
        layout.angles.indexOf(angle),
        layout.frames.indexOf(frame),
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
        authors: cell?.file.spriteAuthors || [],
        state: cell?.file.spriteState,
        url: cell?.file.url,
      });
    }
  }
  return {
    date: version.date,
    sha: version.sha,
    authors: version.authors || [],
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

import sharp from "sharp";

/**
 * Creates a spritesheet from a grid layout using Sharp.
 * 
 * @param layout - The grid layout of sprites
 * @param cellW - Width of each cell in pixels
 * @param cellH - Height of each cell in pixels
 * @param outputPath - Path where the spritesheet should be saved
 * @param opts - Additional options for spritesheet creation
 * @returns A promise that resolves to an object containing the width and height of the created spritesheet
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

  const composites: sharp.OverlayOptions[] = [];
  for (const frame of opts.layout.frames) {
    for (const angle of opts.layout.angles) {
      const key = `${frame}_${angle}`;
      const cell = opts.paddedPaths.get(key);
      if (!cell) continue;
      const pos = cellToPosition(
        opts.layout.angles.indexOf(angle),
        opts.layout.frames.indexOf(frame),
        cellW,
        cellH,
      );
      composites.push({
        input: cell.path,
        top: pos.y,
        left: pos.x,
      });
    }
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ lossless: true })
    .toFile(outputPath);

  return { w: width, h: height };
}
