import { z } from "zod";

/**
 * Zod schemas for validating spritesheet data.
 */
/**
 * List of known 4-letter Doom sprite codes in Freedoom.
 */
export const SpriteCodes = [
  "BOS2",
  "BOSS",
  "BSPI",
  "CPOS",
  "CYBR",
  "FATT",
  "HEAD",
  "KEEN",
  "PAIN",
  "PLAY",
  "POSS",
  "SARG",
  "SKEL",
  "SKUL",
  "SPID",
  "SPOS",
  "TROO",
  "VILE",
] as const;

/**
 * Type representing one of the known sprite codes.
 */
export type SpriteCode = (typeof SpriteCodes)[number];
 
export const AuthorSchema = z.object({
  name: z.string(),
  relation: z.string().optional(),
});

export type Author = z.infer<typeof AuthorSchema>;

export const SpriteSchema = z.object({
  frame: z.string(),
  angle: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  authors: z.array(AuthorSchema),
  state: z.string(),
  url: z.string(),
});
 
export type Sprite = z.infer<typeof SpriteSchema>;
 
export const SpritesheetVersionSchema = z.object({
  date: z.string(),
  sha: z.string(),
  authors: z.array(AuthorSchema),
  commitMessage: z.string(),
  commitUrl: z.string(),
  spritesheetPath: z.string(),
  source: z.string(),
  index: z.number().optional(),
  sprites: z.array(SpriteSchema),
});

export type SpritesheetVersion = z.infer<typeof SpritesheetVersionSchema>;

export const AnimationStepSchema = z.object({
  frame: z.string(),
  delay: z.number(),
});

export type AnimationStep = z.infer<typeof AnimationStepSchema>;

export const SpriteMetaSchema = z.object({
  doomName: z.string(),
  freedoomName: z.string(),
  description: z.string(),
  sprite: z.string(),
  idling: z.array(AnimationStepSchema).optional(),
  chasing: z.array(AnimationStepSchema).optional(),
  attacking: z.array(AnimationStepSchema).optional(),
  hurting: z.array(AnimationStepSchema).optional(),
  dying: z.array(AnimationStepSchema).optional(),
  gibbing: z.array(AnimationStepSchema).optional(),
});

export type SpriteMeta = z.infer<typeof SpriteMetaSchema>;

export const SpritesheetsDataSchema = z.record(
  z.enum(SpriteCodes),
  z.array(SpritesheetVersionSchema),
);

export type SpritesheetsData = z.infer<typeof SpritesheetsDataSchema>;
