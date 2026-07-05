import { z } from "zod";
import { ContributionSchema } from "./contribution";
import { CharacterCodeSchema } from "./character";

/**
 * Metadata for a single sprite frame extracted by a parser.
 */
export const ParsedSpriteSchema = z.object({
	/** Original file name (e.g., "possa1.png") */
	name: z.string(),
	/** Direct GitHub URL to the sprite at this specific commit */
	url: z.string(),
	/** Authors who worked on this specific sprite frame */
	contributions: z.array(ContributionSchema),
	/** Status of the sprite relative to the previous version */
	state: z.enum(["new", "updated", "unchanged"]),
	/** ISO date string of when this sprite last changed */
	lastChangedDate: z.string(),
	/** Index within the batch/commit */
	index: z.number().int(),
	/** Source repository context */
	source: z.enum(["freedoom", "attic"]).optional(),
});

/**
 * A snapshot of all sprites for a character at a specific point in time/commit.
 */
export const ParsedSnapshotSchema = z.object({
	/** ISO date string of the commit or event */
	date: z.string(),
	/** The commit message or event description */
	message: z.string(),
	/** Source repository or stream */
	source: z.enum(["freedoom", "attic"]),
	/** URL for the commit or event */
	url: z.string(),
	/** SHA or unique identifier for the event */
	sha: z.string(),
	/** Authors of the change (event-level contributions) */
	contributions: z.array(ContributionSchema),
	/** Sequential index of the snapshot */
	index: z.number().int(),
	/** Optional subdirectory context */
	folder: z.string().optional(),
	/** Collection of sprites included in this version */
	sprites: z.array(ParsedSpriteSchema),
});

/**
 * Full version history or collection for a specific character.
 * Root schema for intermediate data passed to generators.
 */
export const ParsedCharacterSchema = z.object({
	/** 4-character sprite code (e.g., "POSS", "CYBR") */
	code: CharacterCodeSchema,
	/** Chronological list of snapshots */
	versions: z.array(ParsedSnapshotSchema),
});

export type ParsedSprite = z.infer<typeof ParsedSpriteSchema>;
export type ParsedSnapshot = z.infer<typeof ParsedSnapshotSchema>;
export type ParsedCharacter = z.infer<typeof ParsedCharacterSchema>;
