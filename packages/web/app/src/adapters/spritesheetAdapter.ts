import rawData from "@sprite-collection/spritesheets.json";

import z, { ZodType } from "zod";
import { SpritesheetsDataSchema } from "../models/schema.ts";

/**
 * Adapter for processing spritesheet data.
 * Directly imports the data from the sprite-collection package.
 */
class SpritesheetAdapter {
  /**
   * Validates and returns the processed spritesheet data.
   * Throws an error if the data does not match the expected schema.
   */
  static getSpritesheets<T>(
    inputSchema: ZodType<T>,
    rawData: unknown,
  ): T {
    try {
      return inputSchema.parse(rawData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Spritesheet validation failed:", error.issues);
        throw new Error(`Invalid spritesheet data: ${error.message}`);
      }
      throw error;
    }
  }
}

export const spritesheets = SpritesheetAdapter.getSpritesheets(
  SpritesheetsDataSchema,
  rawData,
);
