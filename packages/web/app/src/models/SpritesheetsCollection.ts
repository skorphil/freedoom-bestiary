import type { 
  Spritesheet as SpritesheetData, 
  Character, 
  CharacterCode,
  SpritesheetsMap
} from "@freedoom-bestiary/database";

export type CharacterSpritesheetsMap = Record<CharacterCode, SpritesheetData[]>;

/** Convert nested spritesheets map to character-based map */
export function organizeSpritesheetsByCharacter(spritesheets: SpritesheetsMap): CharacterSpritesheetsMap {
  const result: CharacterSpritesheetsMap = {} as CharacterSpritesheetsMap;
  
  for (const [characterCode, characterSheets] of Object.entries(spritesheets)) {
    const code = characterCode as CharacterCode;
    result[code] = Object.values(characterSheets);
  }
  
  return result;
}

export class SpritesheetsCollection {
  constructor(private data: CharacterSpritesheetsMap) {}

  /** Returns all available character codes */
  getAllCodes(): CharacterCode[] {
    return Object.keys(this.data) as CharacterCode[];
  }

  /** Gets the full evolution history for a specific character code */
  getHistory(code: CharacterCode): SpritesheetData[] {
    return this.data[code] ?? [];
  }

  /** Gets the latest version (most recent date) for a specific character code */
  getLatest(code: CharacterCode): SpritesheetData | undefined {
    const history = this.getHistory(code);
    if (history.length === 0) return undefined;
    
    return [...history].sort((a, b) => 
      new Date(b.commitDate).getTime() - new Date(a.commitDate).getTime()
    )[0];
  }

  /** Gets the original version (oldest date) for a specific character code */
  getOriginal(code: CharacterCode): SpritesheetData | undefined {
    const history = this.getHistory(code);
    if (history.length === 0) return undefined;
    
    return [...history].sort((a, b) => 
      new Date(a.commitDate).getTime() - new Date(b.commitDate).getTime()
    )[0];
  }

  /** Checks if a spritesheet is from the attic repository */
  isAtticEntry(sheet: SpritesheetData): boolean {
    return sheet.commitUrl.includes("/attic/");
  }

  /** Gets the latest live (non-attic) entry from a list of versions */
  getLatestLiveEntry(sheets: SpritesheetData[]): SpritesheetData | undefined {
    const live = sheets.filter(s => !this.isAtticEntry(s));
    if (live.length === 0) return undefined;
    
    return [...live].sort((a, b) => 
      new Date(b.commitDate).getTime() - new Date(a.commitDate).getTime()
    )[0];
  }

  /** Gets unique author names for a specific spritesheet version */
  getUniqueAuthors(sheet: SpritesheetData): string[] {
    const contributorIds = new Set<string>();
    
    // Collect from sheet-level contributions
    for (const contrib of sheet.contributions) {
      contributorIds.add(contrib.contributorId);
    }
    
    // Collect from sprite-level contributions
    for (const sprite of sheet.sprites) {
      for (const contrib of sprite.contributions) {
        contributorIds.add(contrib.contributorId);
      }
    }
    
    return [...contributorIds].sort((a, b) => a.localeCompare(b));
  }

  /** Gets authors with their relations for a specific version */
  getAuthorsWithRelations(sheet: SpritesheetData): { name: string; relation?: string }[] {
    const authorsMap = new Map<string, string | undefined>();
    
    // Process sprite-level contributions
    for (const sprite of sheet.sprites) {
      for (const contrib of sprite.contributions) {
        if (!authorsMap.has(contrib.contributorId)) {
          authorsMap.set(contrib.contributorId, contrib.relation);
        }
      }
    }
    
    // Process sheet-level contributions (higher priority)
    for (const contrib of sheet.contributions) {
      authorsMap.set(contrib.contributorId, contrib.relation);
    }
    
    // Resolve IDs to names
    const result: { name: string; relation?: string }[] = [];
    for (const [id, relation] of authorsMap.entries()) {
      result.push({ name: id, relation });
    }
    
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Gets a sorted list of unique authors across all versions for a specific character */
  getAuthors(code: CharacterCode): string[] {
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

  /** Gets all contributions for a specific author name */
  getAuthorContributions(authorName: string): { code: CharacterCode; sheet: SpritesheetData }[] {
    const contributions: { code: CharacterCode; sheet: SpritesheetData }[] = [];
    const codes = this.getAllCodes();

    for (const code of codes) {
      const history = this.getHistory(code);
      for (const sheet of history) {
        const authors = this.getUniqueAuthors(sheet);
        if (authors.includes(authorName)) {
          contributions.push({ code, sheet });
        }
      }
    }

    return contributions.sort((a, b) => 
      new Date(b.sheet.commitDate).getTime() - new Date(a.sheet.commitDate).getTime()
    );
  }
}

/** Factory function to create collection from repository data */
export function createSpritesheetsCollection(data: SpritesheetsMap): SpritesheetsCollection {
  const organizedData = organizeSpritesheetsByCharacter(data);
  return new SpritesheetsCollection(organizedData);
}
