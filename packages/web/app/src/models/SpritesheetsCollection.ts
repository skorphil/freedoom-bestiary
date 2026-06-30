import { SpriteCode, SpritesheetsData } from "./schema.ts";
import { spritesheets } from "../adapters/spritesheetAdapter.ts";

type SpritesheetVersion = SpritesheetsData[SpriteCode][number];

/** Model for interacting with the collection of spritesheets and their evolution history */
export class SpriteCollection {
  constructor(private data: SpritesheetsData) {}

  /** Returns all available character codes */
  getAllCodes(): SpriteCode[] {
    return Object.keys(this.data) as SpriteCode[];
  }

  /** Gets the full evolution history for a specific character code */
  getHistory(code: string): SpritesheetVersion[] {
    const key = this.#getNormalizedKey(code);
    return key ? this.data[key as SpriteCode] : [];
  }

  /** Gets the latest version (first in history) for a specific character code */
  getLatest(code: string): SpritesheetVersion | undefined {
    const history = this.getHistory(code);
    if (history.length > 0) return history[0];

    throw Error("No spritesheet versions found");
  }

  /** Gets the original version (last in history) for a specific character code */
  getOriginal(code: string): SpritesheetVersion | undefined {
    const history = this.getHistory(code);
    return history.length > 0 ? history[history.length - 1] : undefined;
  }

  /** Checks if a version entry is from the attic repository */
  isAtticEntry(entry: SpritesheetVersion): boolean {
    return entry.commitUrl.includes("/attic/");
  }

  /** Gets the latest live (non-attic) entry from a list of versions */
  getLatestLiveEntry(
    entries: SpritesheetVersion[],
  ): SpritesheetVersion | undefined {
    const live = entries.filter((e) => !this.isAtticEntry(e));
    return [...live].sort((a, b) => b.date.localeCompare(a.date))[0];
  }

  /** Gets a sorted list of unique authors across multiple version entries */
  getUniqueAuthors(spritesheetVersion: SpritesheetVersion): string[] {
    const authors = this.getAuthorsWithRelations(spritesheetVersion);
    return authors.map(a => a.name);
  }

  /** Gets unique authors with their relations */
  getAuthorsWithRelations(spritesheetVersion: SpritesheetVersion): { name: string; relation?: string }[] {
    const authorsMap = new Map<string, string | undefined>();
    
    // Process sprite-level authors
    for (const sprite of spritesheetVersion.sprites) {
      if (sprite.authors) {
        for (const author of sprite.authors) {
          // If already seen, keep existing relation (prefer commit-level if available later)
          if (!authorsMap.has(author.name)) {
            authorsMap.set(author.name, author.relation);
          }
        }
      }
    }
    
    // Process commit-level authors (higher priority for overall relation)
    if (spritesheetVersion.authors) {
      for (const author of spritesheetVersion.authors) {
        authorsMap.set(author.name, author.relation);
      }
    }
    
    return Array.from(authorsMap.entries())
      .map(([name, relation]) => ({ name, relation }))
      .filter(a => !!a.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Gets a sorted list of unique authors across all versions for a specific character code */
  getAuthors(code: string): string[] {
    const history = this.getHistory(code);
    if (history.length === 0) return [];

    const allAuthors = new Set<string>();
    for (const version of history) {
      const versionAuthors = this.getUniqueAuthors(version);
      for (const author of versionAuthors) {
        allAuthors.add(author);
      }
    }
    return [...allAuthors].sort((a, b) => a.localeCompare(b));
  }

  /** Normalizes the code to match the keys in the data record (case-insensitive search) */
  #getNormalizedKey(code: string): string | undefined {
    const upperCode = code.toUpperCase();
    return Object.keys(this.data).find((k) => k.toUpperCase() === upperCode);
  }
}

/** Default instance of the Bestiary initialized with production data */
export const bestiary = new SpriteCollection(spritesheets);
