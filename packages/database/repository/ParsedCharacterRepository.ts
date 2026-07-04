import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { 
  ParsedCharacterSchema, 
  ParsedSnapshotSchema,
  type ParsedCharacter, 
  type ParsedSnapshot 
} from "../schema/parsed-data";
import * as JSONC from "comment-json";

/**
 * Repository for managing parsed character data stored in .jsonc files.
 * Handles reading and appending snapshots for characters.
 */
export class ParsedCharacterRepository {
  private static readonly DATA_DIR = join(
    import.meta.dirname, 
    "../data/parsedCharacters"
  );

  /**
   * Gets the full parsed character history from a .jsonc file.
   * If the file doesn't exist, returns an empty ParsedCharacter structure.
   */
  static getParsedCharacter(spriteCode: string): ParsedCharacter {
    const filePath = join(this.DATA_DIR, `${spriteCode.toUpperCase()}.jsonc`);

    if (!existsSync(filePath)) {
      return {
        code: spriteCode.toUpperCase(),
        versions: []
      };
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      const parsed = JSONC.parse(content);
      console.log(`Parsed character data for ${spriteCode} from ${filePath}`);
      console.log(`Data being parsed: ${JSON.stringify(parsed, null, 2)}`);
      return ParsedCharacterSchema.parse(parsed);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        console.error(`Zod validation failed for ${filePath}:`, JSON.stringify((error as any).errors, null, 2));
      } else {
        console.error(`Failed to read or parse ${filePath}:`, error);
      }
      throw error;
    }
  }

  /**
   * Appends a new snapshot to a character's version history and saves the file.
   * Ensures the version history remains chronological based on the snapshot index.
   */
  static appendSnapshot(spriteCode: string, snapshot: ParsedSnapshot): void {
    const validatedSnapshot = ParsedSnapshotSchema.parse(snapshot);
    const character = this.getParsedCharacter(spriteCode);
    
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
    // Note: We need a better sort if index is just per-SHA. 
    // Usually we want chronological by date first.
    character.versions.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.index - b.index;
    });

    this.saveParsedCharacter(character);
  }

  /**
   * Saves the ParsedCharacter data back to its .jsonc file.
   */
  private static saveParsedCharacter(character: ParsedCharacter): void {
    const validatedCharacter = ParsedCharacterSchema.parse(character);
    const filePath = join(this.DATA_DIR, `${validatedCharacter.code.toUpperCase()}.jsonc`);
    
    try {
      const content = JSONC.stringify(validatedCharacter, null, 2);
      if (!existsSync(this.DATA_DIR)) {
        console.debug(`Creating directory ${this.DATA_DIR}`);
        mkdirSync(this.DATA_DIR, { recursive: true });
      }
      writeFileSync(filePath, content, "utf-8");
    } catch (error) {
      console.error(`Failed to write ${filePath}:`, error);
      throw new Error(`Could not save parsed character data for ${validatedCharacter.code}`);
    }
  }
}
