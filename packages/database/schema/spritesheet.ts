import { z } from "zod";
import { CharacterCodeSchema } from "./character";
import { ContributionSchema } from "./contribution";

/** Individual sprite metadata within a spritesheet */
export const SpriteSchema = z.object({
	/** Direct github url to sprite */
	spriteUrl: z.string(),
	frame: z.string(),
	angle: z.number().int(),
	x: z.number().int(),
	y: z.number().int(),
	width: z.number().int(),
	height: z.number().int(),
	/** State, relative to spritesheet commit */
	state: z.enum(["new", "updated", "unchanged"]),
	contributions: z.array(ContributionSchema),
});

/** A specific version snapshot of a single character's design */
export const SpritesheetSchema = z.object({
	/** Unique identifier for this spritesheet version */
	spritesheetId: z.uuid(),
	/** Format: [spriteCode].[sha].[spritesheetId].webp */
	fileName: z.string(),
	/** Public URL or path to the webp file */
	filePath: z.string(),
	commitDate: z.coerce.date(),
	commitSha: z.string(),
	commitMessage: z.string(),
	commitUrl: z.string(),
	/** Source repository */
	source: z.enum(["freedoom", "attic"]).optional(),
	sprites: z.array(SpriteSchema),
	contributions: z.array(ContributionSchema),
});

/** Map of spritesheets by character code (enum), then by spritesheet ID */
export const SpritesheetsMapSchema = z.record(
	z.string().refine((val) => CharacterCodeSchema.safeParse(val).success, {
		message: "Invalid character code",
	}),
	z.record(
		z.string(), // spritesheetId (UUID)
		SpritesheetSchema,
	),
);

export type Sprite = z.infer<typeof SpriteSchema>;
export type Spritesheet = z.infer<typeof SpritesheetSchema>;
export type SpritesheetsMap = z.infer<typeof SpritesheetsMapSchema>;
