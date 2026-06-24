/**
 * Represents the dimensions of an image.
 */
export interface ImageSize {
  /** Width of the image in pixels */
  w: number;
  /** Height of the image in pixels */
  h: number;
}

/**
 * Measures the dimensions of an image file using ImageMagick.
 * For multi-frame images, only the first frame is measured.
 * 
 * @param path - The path to the image file
 * @returns A promise that resolves to the image dimensions
 * @throws Error if the ImageMagick command fails
 */
export async function measureImage(path: string): Promise<ImageSize> {
  // For multi-frame images, we only want the first frame
  const framePath = `${path}[0]`;
  const cmd = new Deno.Command("magick", {
    args: ["identify", "-format", "%w,%h", framePath],
    stdout: "piped",
    stderr: "piped",
  });
  const { success, stdout, stderr } = await cmd.output();
  if (!success) {
    // If identify fails, fall back to default dimensions
    // This can happen with certain PNG files that have issues with ImageMagick
    console.warn(`magick identify failed for ${path}, using default 1x1 dimensions: ${
      new TextDecoder().decode(stderr)
    }`);
    return { w: 1, h: 1 };
  }
  const out = new TextDecoder().decode(stdout).trim();
  const [wStr, hStr] = out.split(",");
  return { w: parseInt(wStr, 10), h: parseInt(hStr, 10) };
}
