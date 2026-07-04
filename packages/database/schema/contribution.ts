import { z } from 'zod'


/** Contribution information for a specific sprite */
export const ContributionSchema = z.object({
  contributorId: z.string(),
  /** AI generated relation, based on git message, CREDITS and git commiter */
  relation: z.string()
})

/** Map of sprite URLs to their contributions */
export const ContributionsMapSchema = z.record(z.string(), z.array(ContributionSchema))

export type Contribution = z.infer<typeof ContributionSchema>
export type ContributionsMap = z.infer<typeof ContributionsMapSchema>
