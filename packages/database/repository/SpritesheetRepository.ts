import { SpritesheetsMapSchema, SpritesheetSchema, type SpritesheetsMap, type Spritesheet } from "../schema/spritesheet"
import { CharacterCodeSchema } from "../schema/character"

const DEFAULT_DATA_URL = new URL("../data/spritesheets.jsonc", import.meta.url)

/** Options for SpritesheetRepository operations */
export type SpritesheetRepositoryOptions = {
  /** 
   * Custom path to spritesheets.jsonc file. 
   * Images will be saved relative to this file in a 'spritesheets/' subfolder.
   */
  dataPath?: string;
}

/** Reads Spritesheet data from local FS and returns typed data */
export class SpritesheetRepository {
  private static cachedData: SpritesheetsMap | null = null;
  private static lastDataUrl: string | null = null;
  private static isMocked = false;

  /** Sets isolated mock data for testing */
  static setData(data: SpritesheetsMap): void {
    this.cachedData = data;
    this.isMocked = true;
  }

  /** Resets data to original production state */
  static reset(): void {
    this.cachedData = null;
    this.lastDataUrl = null;
    this.isMocked = false;
  }

  private static getDataUrl(options?: SpritesheetRepositoryOptions): URL {
    if (options?.dataPath) return new URL(`file://${options.dataPath}`);
    return process.env.SPRITESHEET_DATA_URL 
      ? new URL(`file://${process.env.SPRITESHEET_DATA_URL}`)
      : DEFAULT_DATA_URL;
  }

  private static async loadData(options?: SpritesheetRepositoryOptions): Promise<SpritesheetsMap> {
    if (this.isMocked && this.cachedData) return this.cachedData;
    const dataUrl = this.getDataUrl(options);
    const currentUrl = dataUrl.toString();
    if (this.cachedData && this.lastDataUrl === currentUrl) return this.cachedData;
    this.lastDataUrl = currentUrl;
    this.cachedData = null; // Reset cache when URL changes

    const file = Bun.file(dataUrl);
    if (!(await file.exists())) {
      console.warn(`SpritesheetRepository: File not found at ${currentUrl}, starting empty`);
      this.cachedData = {};
      return this.cachedData;
    }

    try {
      const content = await file.text();
      // More robust comment stripping that handles both // and /* */
      const jsonText = content
        .replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1')
        .trim();
      
      if (!jsonText) {
        this.cachedData = {};
        return this.cachedData;
      }

      const json = JSON.parse(jsonText);
      this.cachedData = SpritesheetsMapSchema.parse(json)
      return this.cachedData
    } catch (e) {
      console.warn("SpritesheetRepository: Failed to load data, starting empty", e)
      this.cachedData = {};
      return this.cachedData
    }
  }

  /** Returns all spritesheets grouped by character code, then by spritesheet ID */
  static async getAllSpritesheets(options?: SpritesheetRepositoryOptions): Promise<SpritesheetsMap> {
    return this.loadData(options)
  }

  /** Returns all spritesheets for a specific character code */
  static async getSpritesheetsByCharacterCode(characterCode: string, options?: SpritesheetRepositoryOptions): Promise<Spritesheet[]> {
    const data = await this.loadData(options);
    const characterGroup = data[characterCode.toUpperCase() as keyof typeof data];
    if (!characterGroup) {
      return [];
    }
    return Object.values(characterGroup);
  }

  /** Returns a spritesheet by character code and spritesheet ID */
  static async getSpritesheetById(characterCode: string, spritesheetId: string, options?: SpritesheetRepositoryOptions): Promise<Spritesheet> {
    const data = await this.loadData(options);
    const characterGroup = data[characterCode.toUpperCase() as keyof typeof data];
    if (!characterGroup) {
      throw new Error(`No spritesheets found for character ${characterCode}`)
    }
    const spritesheet = characterGroup[spritesheetId];
    if (!spritesheet) {
      throw new Error(`Spritesheet with ID ${spritesheetId} not found for character ${characterCode}`)
    }
    return spritesheet
  }

  /** Returns spritesheets for a specific commit SHA across all characters */
  static async getSpritesheetsByCommit(commitSha: string, options?: SpritesheetRepositoryOptions): Promise<Spritesheet[]> {
    const data = await this.loadData(options);
    const result: Spritesheet[] = [];
    for (const characterGroup of Object.values(data)) {
      for (const sheet of Object.values(characterGroup)) {
        if (sheet.commitSha === commitSha) {
          result.push(sheet);
        }
      }
    }
    return result;
  }

  /** Appends new spritesheet into spritesheets.jsonc and saves the image file */
  static async addSpritesheet(characterCode: string, spritesheet: Spritesheet, imageData: Uint8Array, options?: SpritesheetRepositoryOptions): Promise<void> {
    const data = await this.loadData(options);
    const validatedSpritesheet = SpritesheetSchema.parse(spritesheet)
    const code = characterCode.toUpperCase() as keyof typeof data;
    
    // Initialize character group if doesn't exist
    if (!data[code]) {
      data[code] = {};
    }
    
    const key = validatedSpritesheet.spritesheetId
    data[code]![key] = validatedSpritesheet

    const dataUrl = this.getDataUrl(options);

    // Ensure the data directory is extracted correctly from the URL
    // URL resolution can be tricky with file paths, so we use a robust method
    const dataUrlString = dataUrl.toString();
    const dataDirUrlString = dataUrlString.substring(0, dataUrlString.lastIndexOf("/") + 1);
    const dataDirUrl = new URL(dataDirUrlString);
    const sheetsDir = new URL("spritesheets/", dataDirUrl)
    
    // Ensure directories exist
    const { mkdir } = await import("node:fs/promises");
    await mkdir(sheetsDir.pathname, { recursive: true });

    // Save image file
    const imagePath = new URL(validatedSpritesheet.fileName, sheetsDir)
    await Bun.write(imagePath, imageData)

    // Save metadata
    const content = `// This file is auto-generated by spritesheet-generator. Do not edit manually.\n${JSON.stringify(data, null, 2)}`
    await Bun.write(dataUrl, content)
  }
}
