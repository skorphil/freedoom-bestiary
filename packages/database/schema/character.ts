import { z } from "zod";

/** Character code used as key */
export const CharacterCodeSchema = z.enum([
	"POSS", // POSS | SPOS ...
	"SPOS",
	"TROO",
	"SARG",
	"SKUL",
	"HEAD",
	"BOSS",
	"SKEL",
	"FATT",
	"CYBR",
	"SPID",
	"CPOS",
	"BOS2",
	"BSPI",
	"PAIN",
	"VILE",
	"KEEN",
	"PLAY",
]);

/** Name of a character animation */
export const AnimationNameSchema = z.enum([
	"idling", // Idling | Chasing ...
	"chasing",
	"attacking",
	"hurting",
	"dying",
	"gibbing",
]);

/** Step in a character animation */
export const AnimationStepSchema = z.object({
	frame: z.string(),
	delay: z.number().int(),
});

/** Record of all animations for a character */
export const AnimationsMapSchema = z.object({
	idling: z.array(AnimationStepSchema).optional(),
	chasing: z.array(AnimationStepSchema).optional(),
	attacking: z.array(AnimationStepSchema).optional(),
	hurting: z.array(AnimationStepSchema).optional(),
	dying: z.array(AnimationStepSchema).optional(),
	gibbing: z.array(AnimationStepSchema).optional(),
});

/** Character entity schema */
export const CharacterSchema = z.object({
	/** Original Doom2 name */
	doomName: z.string(),
	/** Freedoom replacement name */
	freedoomName: z.string(),
	/** Description of the character in Freedoom */
	description: z.string(),
	animations: AnimationsMapSchema,
});

/** Database of characters keyed by spriteCode */
export const CharactersMapSchema = z.record(
	CharacterCodeSchema,
	CharacterSchema,
);

export type CharacterCode = z.infer<typeof CharacterCodeSchema>;
export type AnimationName = z.infer<typeof AnimationNameSchema>;
export type AnimationStep = z.infer<typeof AnimationStepSchema>;
export type AnimationsMap = z.infer<typeof AnimationsMapSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type CharactersMap = z.infer<typeof CharactersMapSchema>;
