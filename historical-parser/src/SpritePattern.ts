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

/**
 * Resolves author from file path. Handles four path shapes.
 */
export class AuthorResolver {
  /**
   * Resolves the author for a given file path.
   * @param filePath - The file path
   * @param commitAuthor - The commit author (fallback for Shape 1)
   * @returns The resolved author name
   */
  resolveAuthor(filePath: string, commitAuthor: string): string {
    const segments = filePath.split("/").filter((segment) =>
      segment.length > 0
    );
    const spritesIndex = this.findSpritesIndex(segments);

    // Shape 4: <author>/sprites/<file>
    if (spritesIndex > 0) {
      // The author is the segment before "sprites"
      return segments[spritesIndex - 1];
    }

    // Handle cases where "sprites" is at the beginning or not found
    if (spritesIndex === 0) {
      // Shapes 1, 2, 3: sprites/...
      const remainingSegments = segments.slice(1); // Remove "sprites" segment

      if (remainingSegments.length === 1) {
        // Shape 1: sprites/<file>
        return commitAuthor;
      } else if (remainingSegments.length >= 2) {
        const potentialAuthor = remainingSegments[0];

        // Check if the potential author segment is a directory
        if (this.isDirectory(potentialAuthor)) {
          // Shape 2: sprites/<author>/<file> or Shape 3: sprites/<author>/<sub>/<f>
          return potentialAuthor;
        } else {
          // Shape 1: sprites/<file> (but file looks like a directory name)
          return commitAuthor;
        }
      }
    }

    // Default case when "sprites" is not found in path
    return commitAuthor;
  }

  /**
   * Finds the index of "sprites" in a path segment array.
   * @param segments - Path segments
   * @returns The index of "sprites" or -1 if not found
   */
  private findSpritesIndex(segments: string[]): number {
    return segments.indexOf("sprites");
  }

  /**
   * Determines if a segment represents a directory.
   * @param segment - The path segment to check
   * @returns True if the segment is a directory
   */
  private isDirectory(segment: string): boolean {
    return !segment.includes(".");
  }
}

/**
 * Interface for AuthorResolver-like objects (used for mocking).
 * Defines the contract for resolving authors from file paths.
 */
export type AuthorResolverLike = {
  /**
   * Resolves the author for a given file path.
   * @param filePath - The file path
   * @param commitAuthor - The commit author (fallback)
   * @returns The resolved author name
   */
  resolveAuthor(filePath: string, commitAuthor: string): string;
};
