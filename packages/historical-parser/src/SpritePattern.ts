import type { CreditsFileProvider } from "./CreditsFileProvider.ts";

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
  private creditsProvider: CreditsFileProvider | null = null;

  setCreditsProvider(provider: CreditsFileProvider) {
    this.creditsProvider = provider;
  }

  /**
   * Resolves authors for a given file path and commit context.
   * @param filePath - The file path
   * @param commitAuthor - The git commit author
   * @param commitMessage - The commit message to scan for names
   * @param code - Optional sprite code for CREDITS matching
   * @returns Array of resolved author names
   */
  resolveAuthors(filePath: string, commitAuthor: string, commitMessage?: string, code?: string): string[] {
    const authors = new Set<string>();
    
    // 1. Git commit author is always a candidate
    authors.add(commitAuthor);

    // 2. Resolve from file path (Shape 4: <author>/sprites/<file>, etc.)
    const pathAuthor = this.resolveAuthorFromPath(filePath);
    if (pathAuthor && pathAuthor !== commitAuthor) {
      authors.add(pathAuthor);
    }

    // 3. Scan commit message for "by [Name]", "@[Handle]", etc.
    if (commitMessage) {
      const messageAuthors = this.extractAuthorsFromMessage(commitMessage);
      for (const name of messageAuthors) {
        authors.add(name);
      }
    }

    // 4. Resolve from CREDITS file
    if (code && this.creditsProvider) {
      const creditsAuthors = this.creditsProvider.getAuthorsForCode(code);
      for (const name of creditsAuthors) {
        authors.add(name);
      }
    }

    return Array.from(authors).filter(name => name && name.trim().length > 0);
  }

  /**
   * Extracts authors from a string (usually commit message).
   * Supports: "by Name", "by Name and Name", "@Handle", "courtesy of Name"
   */
  private extractAuthorsFromMessage(message: string): string[] {
    const names = new Set<string>();
    
    // Pattern 1: "by Name" or "by Name and Name"
    const byMatches = message.matchAll(/\bby\s+([A-Za-z0-9_@]+(?:\s+(?:and|&)\s+[A-Za-z0-9_@]+)*)/gi);
    for (const match of byMatches) {
      const parts = match[1].split(/\s+(?:and|&)\s+|,/gi);
      for (const p of parts) names.add(p.trim());
    }

    // Pattern 2: "@Handle"
    const handleMatches = message.matchAll(/@([A-Za-z0-9_-]+)/g);
    for (const match of handleMatches) {
      names.add(match[1]);
    }

    // Pattern 3: "courtesy of Name"
    const courtesyMatches = message.matchAll(/courtesy of\s+([A-Za-z0-9_@ ]+)(?:\.|\n|$)/gi);
    for (const match of courtesyMatches) {
      const val = match[1].trim();
      if (val) names.add(val);
    }

    return Array.from(names);
  }

  /**
   * Internal helper to resolve author from file path only.
   */
  private resolveAuthorFromPath(filePath: string): string | null {
    const segments = filePath.split("/").filter((segment) =>
      segment.length > 0
    );
    const spritesIndex = this.findSpritesIndex(segments);

    // Shape 4: <author>/sprites/<file>
    if (spritesIndex > 0) {
      return segments[spritesIndex - 1];
    }

    if (spritesIndex === 0) {
      const remainingSegments = segments.slice(1);
      if (remainingSegments.length >= 2) {
        const potentialAuthor = remainingSegments[0];
        if (this.isDirectory(potentialAuthor)) {
          return potentialAuthor;
        }
      }
    }

    return null;
  }

  /**
   * Resolves the author for a given file path.
   * @deprecated Use resolveAuthors instead
   */
  resolveAuthor(filePath: string, commitAuthor: string): string {
    return this.resolveAuthors(filePath, commitAuthor)[0] || commitAuthor;
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
