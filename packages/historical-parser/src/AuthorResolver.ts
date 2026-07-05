import { ContributionRepository } from "../../database/repository/ContributionRepository.ts";
import { ContributorRepository } from "../../database/repository/ContributorRepository.ts";
import { GitReader } from "./GitReader.ts";
import type { AuthorInfo } from "./types.ts";

export type AuthorResolverOptions = {
	aiToken?: string;
	gatewayUrl?: string;
	noAi?: boolean;
	cachePath?: string;
	freedoomRepoPath?: string;
};

/**
 * Resolves authors for sprites using local cache and OpenAI/Kilo Gateway.
 */
export class AuthorResolver {
	private credits: string = "";

	constructor(private options: AuthorResolverOptions = {}) {}

	/**
	 * Initializes the resolver by loading the cache and CREDITS file.
	 */
	async init() {
		// Load CREDITS file if repo path is provided
		if (this.options.freedoomRepoPath) {
			try {
				const gitReader = new GitReader(this.options.freedoomRepoPath);
				const entries = await gitReader.getTreeEntries("HEAD");
				const creditsEntry = entries.find((e) => e.path === "CREDITS");
				if (creditsEntry) {
					const { stdout, success } = Bun.spawnSync([
						"git",
						"-C",
						this.options.freedoomRepoPath,
						"show",
						"HEAD:CREDITS",
					]);
					if (success) {
						this.credits = new TextDecoder().decode(stdout);
					}
				}
			} catch (e) {
				console.error("Failed to load CREDITS file:", e);
			}
		}
	}

	/**
	 * Resolves authors for a batch of sprites in a commit.
	 * @param context Commit context (author, message)
	 * @param sprites List of sprite URLs and paths to resolve
	 */
	async resolveAuthorsBatch(
		context: { author: string; message: string; sha: string },
		sprites: Array<{ url: string; path: string }>,
	): Promise<Record<string, AuthorInfo[]>> {
		const results: Record<string, AuthorInfo[]> = {};
		const missing: Array<{ url: string; path: string }> = [];

		// 1. Check database first
		for (const sprite of sprites) {
			const contributions = ContributionRepository.getContribution(sprite.url);
			if (contributions.length > 0) {
				results[sprite.url] = contributions.map((c) => {
					try {
						const contributor = ContributorRepository.getContributorById(
							c.contributorId,
						);
						return {
							name: contributor.name,
							relation: c.relation,
							contributorId: c.contributorId,
						};
					} catch (e) {
						// Fallback if ID is in contributions but not in contributors (should not happen normally)
						return {
							name: c.contributorId,
							relation: c.relation,
							contributorId: c.contributorId,
						};
					}
				});
			} else {
				// Fallback: try to resolve by commit author if no contributions found yet
				// and we are in noAi mode, otherwise we'll go to AI
				if (this.options.noAi) {
					const found = ContributorRepository.findByNameOrAlias(context.author);
					if (found) {
						results[sprite.url] = [
							{
								name: found.contributor.name,
								relation: "Committer",
								contributorId: found.id,
							},
						];
					} else {
						const errorMsg =
							`Author "${context.author}" not found in ContributorRepository and AI is disabled (--no-ai). ` +
							`Please add the contributor to contributors.jsonc or enable AI resolution.`;
						console.error(errorMsg);
						throw new Error(errorMsg);
					}
				} else {
					missing.push(sprite);
				}
			}
		}

		if (missing.length === 0) return results;

		// 2. AI Call
		if (!this.options.aiToken || !this.options.gatewayUrl) {
			console.error("AI Context:", {
				hasToken: !!this.options.aiToken,
				gatewayUrl: this.options.gatewayUrl,
			});
			throw new Error("AI Token or Gateway URL missing for author resolution.");
		}

		console.debug(
			`Calling AI Gateway for ${missing.length} missing sprites: ${this.options.gatewayUrl}`,
		);

		// Ensure the URL is trimmed and valid
		const url = this.options.gatewayUrl!.trim();

		// Process granularly
		await this.fetchAuthorsGranularly(context, missing, url, results);

		return results;
	}

	private async fetchAuthorsGranularly(
		context: { author: string; message: string; sha: string },
		missing: Array<{ url: string; path: string }>,
		gatewayUrl: string,
		results: Record<string, AuthorInfo[]>,
	): Promise<void> {
		// Truncate credits if too long
		const truncatedCredits =
			this.credits.length > 5000
				? this.credits.slice(0, 5000) + "\n... (truncated)"
				: this.credits;

		const contributorsMap = ContributorRepository.getAllContributors();
		const contributorsData = Object.entries(contributorsMap).map(
			([id, info]) => ({
				id,
				name: info.name,
				aliases: info.aliases || [],
			}),
		);

		const systemPrompt =
			"You are a specialized tool that returns authorship data for the Freedoom project in strict JSON format.";

		const contextPrompt = `
You are a git history analyzer for the Freedoom project. 
Your task is to identify the authors of specific sprite files and concisely explain their relation to the sprite based on the commit information and project records.

Project Contributors (from CREDITS file):
${truncatedCredits || "No CREDITS file available."}

Commit Information:
- SHA: ${context.sha}
- Author: ${context.author}
- Message: ${context.message}

Guidelines:
1. Identify the persons who relate to the sprite I will provide in next messages.
2. IMPORTANT: Each sprite MUST have at least one author. If no other contributors are identified via the message or folder structure, use the commit author (${context.author}) as the fallback with relation "Committer (<details>)".
3. The commit author is often the one who performed the change, but they might be committing someone else's work (check for "By: ..." "From: ...", "Thanks to: ...", or mentions in the message or in CREDITS content).
4. The author of a sprite can often be identified from a folder name (e.g., for "raymoohawk/sprites/old-zombieman/possa1.png", one author is "raymoohawk").
5. Relation should be concise, but meaningful (e.g., "Original artist", "Updated offsets", "Palette fix", "Conversion", "Committer (<details>)").
6. If multiple people are involved, include all of them.
7. IMPORTANT: In your JSON response, you MUST use the EXACT URL provided in the request as the "url" property.
8. Use the provided contributors list to map names/aliases to contributor IDs.

Project Contributors List (ID, Name, and Aliases):
${JSON.stringify(contributorsData, null, 2)}

Examples:
"https://github.com/freedoom/freedoom/blob/e1a73c3528b831d6754fc6ab7e686d3e6e714bb7/sprites/possa1.png": [
    {
      "contributorId": "mothramaster",
      "relation": "Remaining angles"
    },
    {
      "contributorId": "korp",
      "relation": "Boots"
    },
    {
      "contributorId": "xindage",
      "relation": "Committer"
    }
]
    `.trim();

		const messages = [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: contextPrompt },
			{
				role: "assistant",
				content:
					"I understand the context and guidelines. Please provide the sprite information to resolve.",
			},
		];

		const responseFormat = {
			type: "json_schema",
			json_schema: {
				name: "author_resolution",
				strict: true,
				schema: {
					type: "object",
					properties: {
						url: { type: "string" },
						contributions: {
							type: "array",
							minItems: 1,
							items: {
								type: "object",
								properties: {
									contributorId: { type: "string" },
									relation: { type: "string" },
								},
								required: ["contributorId", "relation"],
								additionalProperties: false,
							},
						},
					},
					required: ["url", "contributions"],
					additionalProperties: false,
				},
			},
		};

		for (const sprite of missing) {
			console.debug(`Resolving author for: ${sprite.path}`);

			const spriteMessage = {
				role: "user",
				content: `Resolve authors for sprite:\n- Path: ${sprite.path}\n- EXACT URL: ${sprite.url}\n- Full File URL: https://github.com/freedoom/freedoom/blob/${context.sha}/${sprite.path}`,
			};

			let resolution: any = null;
			let attempts = 0;
			const maxAttempts = 3;

			while (attempts < maxAttempts) {
				attempts++;
				try {
					const response = await fetch(gatewayUrl, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${this.options.aiToken}`,
						},
						body: JSON.stringify({
							model: "qwen/qwen3-coder-next",
							messages: [...messages, spriteMessage],
							response_format: responseFormat,
						}),
					});

					if (!response.ok) {
						const error = await response.text();
						throw new Error(`AI Gateway error: ${response.status} ${error}`);
					}

					const data = await response.json();
					resolution = JSON.parse(data.choices[0].message.content);
					break;
				} catch (e: any) {
					console.error(
						`Attempt ${attempts} failed for ${sprite.path}: ${e.message}`,
					);
					if (attempts >= maxAttempts) throw e;
					const delay = 2 ** attempts * 1000;
					console.debug(`Retrying in ${delay}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}

			// Use exact URL from sprite object to ensure consistency as requested
			const targetUrl = sprite.url;
			const contributions = resolution.contributions;

			// Ensure all contributors from AI are in the repository
			const allKnownContributors = ContributorRepository.getAllContributors();
			for (const contribution of contributions) {
				if (!allKnownContributors[contribution.contributorId]) {
					console.debug(
						`Adding new contributor from AI: ${contribution.contributorId}`,
					);
					// We don't have full info (aliases, etc.) but we can at least add the ID and a guessed name
					// The AI was given the list of known contributors, so if it returned a new ID,
					// it might be a hallucination or it found a new person.
					// For safety, we'll initialize it.
					await ContributorRepository.addContributor(
						contribution.contributorId,
						{
							name: contribution.contributorId
								.split("-")
								.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
								.join(" "),
						},
					);
				}
			}

			// Update database and results
			for (const contribution of contributions) {
				ContributionRepository.addContribution(targetUrl, contribution);
			}

			results[targetUrl] = contributions.map((c: any) => {
				const contributor = ContributorRepository.getContributorById(
					c.contributorId,
				);
				return {
					name: contributor.name,
					relation: c.relation,
					contributorId: c.contributorId,
				};
			});

			// Persist immediately after each sprite resolution
			await this.saveCache();
		}
	}

	private async fetchAuthorsFromAi(
		context: { author: string; message: string; sha: string },
		missing: Array<{ url: string; path: string }>,
		gatewayUrl: string,
	): Promise<Record<string, AuthorInfo[]>> {
		const results: Record<string, AuthorInfo[]> = {};
		await this.fetchAuthorsGranularly(context, missing, gatewayUrl, results);
		return results;
	}

	/**
	 * Persists the cache to disk.
	 */
	async saveCache() {
		await ContributionRepository.save();
		console.debug(`Author database saved`);
	}
}
