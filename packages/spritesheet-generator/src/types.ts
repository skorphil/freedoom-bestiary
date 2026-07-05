import type {
	Contribution,
	ParsedSprite as DatabaseParsedSprite,
	ParsedSnapshot,
	Sprite,
	Spritesheet,
	SpritesheetsMap,
} from "@freedoom-bestiary/database";

/**
 * Represents a file in a version with its name, URL, and metadata.
 */
export type VersionFile = {
	/** The name of the file */
	name: string;
	/** The URL where the file can be accessed */
	url: string;
	/** The contributions to the sprite (if available) */
	spriteAuthors?: Contribution[];
	/** The state of the sprite (e.g. "unchanged", "new", "updated") */
	spriteState?: "new" | "updated" | "unchanged";
};

/**
 * Represents a version of sprite files with metadata about the commit.
 */
export type Version = {
	/** The date of the commit */
	date: string;
	/** The SHA hash of the commit */
	sha: string;
	/** The URL of the commit */
	url: string;
	/** The contributions to the commit */
	authors: Contribution[];
	/** The commit message */
	message: string;
	/** The source repository */
	source?: "freedoom" | "attic";
	/** The index of the snapshot within the commit */
	index?: number;
	/** The files associated with this version */
	files: VersionFile[];
};

/**
 * Represents a parsed sprite with frame, angle, and mirroring information.
 */
export type ParsedSprite = {
	/** The frame identifier (e.g., "A", "B") */
	frame: string;
	/** The angle of the sprite (0-7) */
	angle: number;
	/** Whether this sprite is a mirror of another */
	mirror: boolean;
	/** The source file name */
	sourceFile: string;
};

/**
 * Represents a grid cell in the sprite layout, extending ParsedSprite with file information.
 */
export type GridCell = ParsedSprite & {
	/** The file associated with this grid cell */
	file: VersionFile;
};

/**
 * Represents the layout of sprites in a grid format with frames and angles.
 */
export type GridLayout = {
	/** Array of frame identifiers */
	frames: string[];
	/** Array of angle values */
	angles: number[];
	/** Map of cells keyed by frame_angle combination */
	cells: Map<string, GridCell>;
};

/**
 * Represents a reference to a blob in a Git repository.
 */
export type BlobRef = {
	/** The repository in "owner/repo" format */
	repo: string;
	/** The SHA hash of the commit */
	sha: string;
	/** The path to the file within the repository */
	path: string;
};

export type {
	Contribution,
	DatabaseParsedSprite,
	ParsedSnapshot,
	Sprite,
	Spritesheet,
	SpritesheetsMap,
};
