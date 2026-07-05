import { 
  ParsedCharacterSchema, 
  ParsedSnapshotSchema,
  type ParsedCharacter, 
  type ParsedSnapshot 
} from "../schema/parsed-data";
import { readJsoncSync, writeJsoncSync, resolveDataPath } from "../utils/jsonc";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Repository for managing parsed character data stored in .jsonc files.
 * Handles reading and appending snapshots for characters.
 */
export class ParsedCharacterRepository {
  private static getFileUrl(spriteCode: string): URL {
    return resolveDataPath(
      `../data/parsedCharacters/${spriteCode.toUpperCase()}.jsonc`,
      import.meta.url
    );
  }

  /**
   * Gets the full parsed character history from a .jsonc file.
   * If the file doesn't exist, returns an empty ParsedCharacter structure.
   */
  static async getParsedCharacter(spriteCode: string): Promise<ParsedCharacter> {
    const fileUrl = this.getFileUrl(spriteCode);
    const pathString = fileURLToPath(fileUrl);

    if (!fs.existsSync(pathString)) {
      return {
        code: spriteCode.toUpperCase(),
        versions: []
      };
    }

    try {
      const parsed = readJsoncSync(fileUrl);
      return ParsedCharacterSchema.parse(parsed);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        console.error(`Zod validation failed for ${fileUrl}:`, JSON.stringify((error as any).errors, null, 2));
      } else {
        console.error(`Failed to read or parse ${fileUrl}:`, error);
      }
      throw error;
    }
  }

  /**
   * Appends a new snapshot to a character's version history and saves the file.
   * Ensures the version history remains chronological based on the snapshot index.
   */
  static async appendSnapshot(spriteCode: string, snapshot: ParsedSnapshot): Promise<void> {
    const validatedSnapshot = ParsedSnapshotSchema.parse(snapshot);
    const character = await this.getParsedCharacter(spriteCode);
    
    // Check if snapshot already exists (by SHA or index) to avoid duplicates
    const existingVersionIndex = character.versions.findIndex(
      v => v.sha === validatedSnapshot.sha && v.index === validatedSnapshot.index
    );

    if (existingVersionIndex !== -1) {
      // Update existing version with new data (to fix issues like name paths)
      character.versions[existingVersionIndex] = validatedSnapshot;
    } else {
      character.versions.push(validatedSnapshot);
    }
    
    // Sort versions by index to maintain chronological order
    character.versions.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.index - b.index;
    });

    await this.saveParsedCharacter(character);
  }

  /**
   * Saves the ParsedCharacter data back to its .jsonc file.
   */
  private static async saveParsedCharacter(character: ParsedCharacter): Promise<void> {
    const validatedCharacter = ParsedCharacterSchema.parse(character);
    const fileUrl = this.getFileUrl(validatedCharacter.code);
    
    try {
      // Ensure directory exists
      const pathString = fileURLToPath(fileUrl);
      const dir = pathString.substring(0, pathString.lastIndexOf("/") + 1);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      writeJsoncSync(fileUrl, validatedCharacter);
    } catch (error) {
      console.error(`Failed to write ${fileUrl}:`, error);
      throw new Error(`Could not save parsed character data for ${validatedCharacter.code}`);
    }
  }
}
