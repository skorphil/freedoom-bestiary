import { z } from "zod";

/** Author of one or more sprites */
export const ContributorSchema = z.object({
	/** Full name or preferred display name */
	name: z.string(),
	/** Other known names or handles used in commits */
	aliases: z.array(z.string()).optional(),
});

export const ContributorsMapSchema = z.record(
	/** contributorId from keys from contributors.jsonc */
	z.string(),
	ContributorSchema,
);

export type Contributor = z.infer<typeof ContributorSchema>;
export type ContributorsMap = z.infer<typeof ContributorsMapSchema>;
