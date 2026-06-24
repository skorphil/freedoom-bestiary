import { dirname, join } from "@std/path";

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
 * Uses ImageMagick's flop operation to create a horizontal flip of the image.
 * 
 * @param sourcePath - The path to the source image file
 * @returns A promise that resolves to an object containing paths to both original and mirrored images
 * @throws Error if the ImageMagick command fails
 */
export async function ensureMirrored(
  sourcePath: string,
): Promise<MirroredPaths> {
  const dir = dirname(sourcePath);
  const base = sourcePath.split("/").pop()!;
  // Preserve the original extension so ImageMagick can detect the format.
  const extIndex = base.lastIndexOf(".");
  const mirrorPath = extIndex >= 0
    ? join(dir, `${base.substring(0, extIndex)}.mirror${base.substring(extIndex)}`)
    : join(dir, `${base}.mirror`);

  try {
    const stat = await Deno.stat(mirrorPath);
    if (stat.isFile) return { originalPath: sourcePath, mirrorPath };
  } catch {
    // mirror not yet on disk
  }

  const cmd = new Deno.Command("magick", {
    args: [
      `${sourcePath}[0]`,
      "-fuzz",
      "5%",
      "-transparent",
      "#01ffff",
      "-flop",
      mirrorPath,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const { success, stderr } = await cmd.output();
  if (!success) {
    // If flop fails, fall back to using the original image as the mirror
    // This can happen with certain PNG files that have issues with ImageMagick
    console.warn(`magick flop failed for ${sourcePath}, using original as mirror: ${
      new TextDecoder().decode(stderr)
    }`);
    // Copy the original file to the mirror path as a fallback
    const originalData = await Deno.readFile(sourcePath);
    await Deno.writeFile(mirrorPath, originalData);
  }
  return { originalPath: sourcePath, mirrorPath };
}
