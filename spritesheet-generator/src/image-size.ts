import sharp from "sharp";

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
 * Measures the dimensions of an image file using Sharp.
 * 
 * @param path - The path to the image file
 * @returns A promise that resolves to the image dimensions
 */
export async function measureImage(path: string): Promise<ImageSize> {
  try {
    const metadata = await sharp(path).metadata();
    return {
      w: metadata.width ?? 1,
      h: metadata.height ?? 1,
    };
  } catch (error) {
    console.warn(`sharp metadata failed for ${path}, using default 1x1 dimensions: ${
      (error as Error).message
    }`);
    return { w: 1, h: 1 };
  }
}
