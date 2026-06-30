/**
 * Encapsulates sprite filename regex and frame-key parsing for one sprite code.
 *
 * @example
 * const pattern = new SpritePattern("POSS");
 * pattern.matches("sprites/possa1.png"); // true
 * pattern.extractCodeFromPath("sprites/possa1.png"); // "POSS"
 * pattern.extractFrameKey("sprites/possa2a8.png"); // "a2"
 */
export class SpritePattern {
  /** The sprite code (uppercase) */
  readonly code: string;
  private readonly regex: RegExp;

  /**
   * Creates a new SpritePattern for the given code.
   * @param code - The sprite code (e.g., "POSS", "CYBR")
   */
  constructor(code: string) {
    this.code = code.toUpperCase();
    // Matches standard Doom sprite filenames: <CODE><FRAME><ANGLE>[<FRAME><ANGLE>].(png|gif)
    // Examples: POSSA1.png, POSSA2A8.gif
    // Strictly excludes suffixes like .mirror.gif
    this.regex = new RegExp(`^${this.code}[a-z][0-9]([a-z][0-9])?\\.(png|gif)$`, "i");
  }

  /**
   * Checks if a file path matches the sprite pattern.
   * @param filePath - The file path to check
   * @returns True if the path matches the sprite pattern
   */
  matches(filePath: string): boolean {
    const basename = SpritePattern.basename(filePath);
    return this.regex.test(basename);
  }

  /**
   * Extracts the sprite code from a file path.
   * @param filePath - The file path
   * @returns The sprite code or null if not found
   */
  extractCodeFromPath(filePath: string): string | null {
    const basename = SpritePattern.basename(filePath);
    const match = basename.match(/^([a-zA-Z0-9]{4})[a-z]/i);
    return match ? match[1].toUpperCase() : null;
  }

  /**
   * Extracts the frame key from a sprite filename.
   * @param filePath - The file path
   * @returns The frame key or null if not found
   */
  extractFrameKey(filePath: string): string | null {
    const basename = SpritePattern.basename(filePath);
    // Capture letter + angle digit (e.g. "possa2a8.png" with code POSS → "a2")
    const match = basename.match(new RegExp(`^${this.code}([a-z]\\d)`, "i"));
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Static helper to extract the basename from a path.
   * @param path - The full path
   * @returns The filename without directory
   */
  static basename(path: string): string {
    return path.split("/").pop() || path.split("\\").pop() || path;
  }

  /** Static methods accessible via instance */
  static = {
    basename: SpritePattern.basename,
  };
}

/**
 * Interface for SpritePattern-like objects (used for mocking).
 * Defines the contract for sprite pattern matching and extraction.
 */
export type SpritePatternLike = {
  /** The sprite code (uppercase) */
  code: string;
  /** Checks if a file path matches the sprite pattern */
  matches(filePath: string): boolean;
  /** Extracts the sprite code from a file path */
  extractCodeFromPath(filePath: string): string | null;
  /** Extracts the frame key from a sprite filename */
  extractFrameKey(filePath: string): string | null;
  /** Static methods accessible via instance */
  static: {
    /** Extracts the basename from a path */
    basename(path: string): string;
  };
};
