/**
 * Represents an author with a name and their relation to the work.
 */
export type Author = {
  /** The name of the author */
  name: string;
  /** The relation of the author to the work (e.g. "Committer", "Original artist") */
  relation?: string;
};

/**
 * Represents a file in a version with its name, URL, and metadata.
 */
export interface VersionFile {
  /** The name of the file */
  name: string;
  /** The URL where the file can be accessed */
  url: string;
  /** The authors of the sprite (if available) */
  spriteAuthors?: Author[];
  /** The state of the sprite (e.g. "unchanged", "new", "updated") */
  spriteState?: string;
}

/**
 * Represents a version of sprite files with metadata about the commit.
 */
export interface Version {
  /** The date of the commit */
  date: string;
  /** The SHA hash of the commit */
  sha: string;
  /** The URL of the commit */
  url: string;
  /** The authors of the commit */
  authors: Author[];
  /** The commit message */
  message: string;
  /** The source repository */
  source?: "freedoom" | "attic";
  /** The files associated with this version */
  files: VersionFile[];
}

/**
 * Represents a parsed sprite with frame, angle, and mirroring information.
 */
export interface ParsedSprite {
  /** The frame identifier (e.g., "A", "B") */
  frame: string;
  /** The angle of the sprite (0-7) */
  angle: number;
  /** Whether this sprite is a mirror of another */
  mirror: boolean;
  /** The source file name */
  sourceFile: string;
}

/**
 * Represents a grid cell in the sprite layout, extending ParsedSprite with file information.
 */
export interface GridCell extends ParsedSprite {
  /** The file associated with this grid cell */
  file: VersionFile;
}

/**
 * Represents the layout of sprites in a grid format with frames and angles.
 */
export interface GridLayout {
  /** Array of frame identifiers */
  frames: string[];
  /** Array of angle values */
  angles: number[];
  /** Map of cells keyed by frame_angle combination */
  cells: Map<string, GridCell>;
}

/**
 * Represents a reference to a blob in a Git repository.
 */
export interface BlobRef {
  /** The repository in "owner/repo" format */
  repo: string;
  /** The SHA hash of the commit */
  sha: string;
  /** The path to the file within the repository */
  path: string;
}

/**
 * Represents an entry for a sprite in the spritesheet with positioning and metadata.
 */
export interface SpriteEntry {
  /** The frame identifier */
  frame: string;
  /** The angle as a string */
  angle: string;
  /** The x-coordinate position in the spritesheet */
  x: number;
  /** The y-coordinate position in the spritesheet */
  y: number;
  /** The width of the sprite in pixels */
  width: number;
  /** The height of the sprite in pixels */
  height: number;
  /** The authors of the sprite */
  authors?: Author[];
  /** The state of the sprite */
  state?: string;
  /** The remote Git URL of the sprite */
  url?: string;
}

/**
 * Represents metadata for a version entry in the spritesheet collection.
 */
export interface VersionEntry {
  /** The date of the commit */
  date: string;
  /** The SHA hash of the commit */
  sha: string;
  /** The authors of the commit */
  authors: Author[];
  /** The commit message */
  commitMessage: string;
  /** The URL of the commit */
  commitUrl: string;
  /** The path to the spritesheet file */
  spritesheetPath: string;
  /** The source repository */
  source: "freedoom" | "attic" | "unknown";
  /** Array of sprite entries */
  sprites: SpriteEntry[];
}

/**
 * Represents a collection of spritesheets organized by sprite code.
 */
export type SpritesheetCollection = Record<string, VersionEntry[]>;
