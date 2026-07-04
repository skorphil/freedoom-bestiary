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
 * @param input - The path to the image file or image buffer
 * @returns A promise that resolves to the image dimensions
 */
export async function measureImage(input: string | Uint8Array): Promise<ImageSize> {
  try {
    const metadata = await sharp(input).metadata();
    return {
      w: metadata.width ?? 1,
      h: metadata.height ?? 1,
    };
  } catch (error) {
    console.warn(`sharp metadata failed, using default 1x1 dimensions: ${
      (error as Error).message
    }`);
    return { w: 1, h: 1 };
  }
}
