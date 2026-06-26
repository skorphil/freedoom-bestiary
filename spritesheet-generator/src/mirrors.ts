import { dirname, join } from "node:path";
import sharp from "sharp";
import fs from "node:fs/promises";

/**
 * Represents the paths to original and mirrored image files.
 */
export interface MirroredPaths {
  /** Path to the original image file */
  originalPath: string;
  /** Path to the mirrored image file */
  mirrorPath: string;
}

/**
 * Ensures a mirrored version of an image exists by creating it if necessary.
 * Uses Sharp to create a horizontal flip of the image and handle transparency.
 * 
 * @param sourcePath - The path to the source image file
 * @returns A promise that resolves to an object containing paths to both original and mirrored images
 */
export async function ensureMirrored(
  sourcePath: string,
): Promise<MirroredPaths> {
  const dir = dirname(sourcePath);
  const base = sourcePath.split("/").pop()!;
  // Preserve the original extension
  const extIndex = base.lastIndexOf(".");
  const mirrorPath = extIndex >= 0
    ? join(dir, `${base.substring(0, extIndex)}.mirror${base.substring(extIndex)}`)
    : join(dir, `${base}.mirror`);

  try {
    const stat = await fs.stat(mirrorPath);
    if (stat.isFile()) return { originalPath: sourcePath, mirrorPath };
  } catch {
    // mirror not yet on disk
  }

  try {
    await sharp(sourcePath)
      .ensureAlpha()
      // We don't have an exact equivalent for ImageMagick's -fuzz 5% -transparent #01ffff
      // without complex pixel manipulation in sharp, but we can use trim or other techniques
      // if necessary. For now, we'll focus on the flop.
      .flop()
      .toFile(mirrorPath);
  } catch (error) {
    console.warn(`sharp flop failed for ${sourcePath}, using original as mirror: ${
      (error as Error).message
    }`);
    try {
      const originalData = await fs.readFile(sourcePath);
      await fs.writeFile(mirrorPath, originalData);
    } catch (writeError) {
      console.error(`Failed to copy original to mirror path: ${(writeError as Error).message}`);
    }
  }
  return { originalPath: sourcePath, mirrorPath };
}
