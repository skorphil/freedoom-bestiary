import type {
	Character,
	CharacterCode,
	CharactersMap,
	ContributorsMap,
	Spritesheet as SpritesheetData,
	SpritesheetsMap,
} from "@freedoom-bestiary/database/schema";
import { Spritesheet } from "./Spritesheet";

export class SpritesheetsCollection {
	private models: Record<CharacterCode, Record<string, Spritesheet>> =
		{} as any;
	private characterMetadata: Partial<Record<CharacterCode, Character>> = {};
	private uuidToCode: Map<string, CharacterCode> = new Map();
	private contributors: ContributorsMap = {};

	constructor(
		data: SpritesheetsMap,
		characters?: CharactersMap,
		contributors?: ContributorsMap,
	) {
		if (contributors) {
			this.contributors = contributors;
		}

		for (const [code, sheets] of Object.entries(data)) {
			const characterCode = code as CharacterCode;

			// Initialize character metadata if provided
			if (characters && characters[characterCode]) {
				this.characterMetadata[characterCode] = characters[characterCode];
			}

			this.models[characterCode] = {};
			for (const [id, sheetData] of Object.entries(sheets)) {
				this.uuidToCode.set(id, characterCode);

				const getMeta = () => this.characterMetadata[characterCode];
				this.models[characterCode][id] = new Spritesheet(
					characterCode,
					sheetData,
					getMeta,
				);
			}
		}
	}

	/** Returns all available character codes */
	getAllCodes = (): CharacterCode[] => {
		return Object.keys(this.models) as CharacterCode[];
	};

	/** Gets character metadata for a specific code */
	getCharacterMeta = (code: CharacterCode): Character | undefined => {
		return this.characterMetadata[code];
	};

	/** Gets the full evolution history for a specific character code */
	getHistory = (code: CharacterCode): Spritesheet[] => {
		const characterModels = this.models[code];
		if (!characterModels) return [];

		return Object.values(characterModels);
	};

	/** Gets a specific spritesheet by its UUID */
	getById = (code: CharacterCode, uuid: string): Spritesheet | undefined => {
		return this.models[code]?.[uuid];
	};

	/** Gets a specific spritesheet by its UUID alone */
	getByUuid = (uuid: string): Spritesheet | undefined => {
		const code = this.uuidToCode.get(uuid);
		if (!code) return undefined;
		return this.getById(code, uuid);
	};

	/** Gets the latest version (most recent date) for a specific character code */
	getLatest = (code: CharacterCode): Spritesheet | undefined => {
		const history = this.getHistory(code);
		if (history.length === 0) return undefined;

		return [...history].sort(
			(a, b) =>
				new Date(b.data.commitDate).getTime() -
				new Date(a.data.commitDate).getTime(),
		)[0];
	};

	/** Gets the original version (oldest date) for a specific character code */
	getOriginal = (code: CharacterCode): Spritesheet | undefined => {
		const history = this.getHistory(code);
		if (history.length === 0) return undefined;

		return [...history].sort(
			(a, b) =>
				new Date(a.data.commitDate).getTime() -
				new Date(b.data.commitDate).getTime(),
		)[0];
	};

	/** Checks if a spritesheet is from the attic repository */
	isAtticEntry = (sheet: Spritesheet): boolean => {
		return sheet.data.commitUrl.includes("/attic/");
	};

	/** Gets the latest live (non-attic) entry from a list of versions */
	getLatestLiveEntry = (sheets: Spritesheet[]): Spritesheet | undefined => {
		const live = sheets.filter((s) => !this.isAtticEntry(s));
		if (live.length === 0) return undefined;

		return [...live].sort(
			(a, b) =>
				new Date(b.data.commitDate).getTime() -
				new Date(a.data.commitDate).getTime(),
		)[0];
	};

	/** Resolves contributor ID to name */
	getContributorName = (contributorId: string): string => {
		const contributor = this.contributors[contributorId];
		return contributor ? contributor.name : contributorId;
	};

	/** Gets unique author names for a specific spritesheet version */
	getUniqueAuthors = (sheet: Spritesheet): string[] => {
		const contributorIds = new Set<string>();

		// Collect from sheet-level contributions
		for (const contrib of sheet.data.contributions) {
			contributorIds.add(contrib.contributorId);
		}

		// Collect from sprite-level contributions
		for (const sprite of sheet.data.sprites) {
			for (const contrib of sprite.contributions) {
				contributorIds.add(contrib.contributorId);
			}
		}

		return [...contributorIds]
			.map((id) => this.getContributorName(id))
			.sort((a, b) => a.localeCompare(b));
	};

	/** Gets authors with their relations for a specific version */
	getAuthorsWithRelations = (
		sheet: Spritesheet,
	): { name: string; relation?: string }[] => {
		const authorsMap = new Map<string, string | undefined>();

		// Process sprite-level contributions
		for (const sprite of sheet.data.sprites) {
			for (const contrib of sprite.contributions) {
				if (!authorsMap.has(contrib.contributorId)) {
					authorsMap.set(contrib.contributorId, contrib.relation);
				}
			}
		}

		// Process sheet-level contributions (higher priority)
		for (const contrib of sheet.data.contributions) {
			authorsMap.set(contrib.contributorId, contrib.relation);
		}

		// Resolve IDs to names
		const result: { name: string; relation?: string }[] = [];
		for (const [id, relation] of authorsMap.entries()) {
			result.push({
				name: this.getContributorName(id),
				relation,
			});
		}

		return result.sort((a, b) => a.name.localeCompare(b.name));
	};

	/** Gets a sorted list of unique authors across all versions for a specific character */
	getAuthors = (code: CharacterCode): string[] => {
		const history = this.getHistory(code);
		if (history.length === 0) return [];

		const allAuthors = new Set<string>();
		for (const version of history) {
			const versionAuthors = this.getUniqueAuthors(version);
			for (const author of versionAuthors) {
				allAuthors.add(author);
			}
		}
		return [...allAuthors].sort((a, b) => a.localeCompare(b));
	};

	/** Gets all contributions for a specific author name */
	getAuthorContributions = (
		authorName: string,
	): { code: CharacterCode; sheet: Spritesheet }[] => {
		const contributions: { code: CharacterCode; sheet: Spritesheet }[] = [];
		const codes = this.getAllCodes();

		for (const code of codes) {
			const history = this.getHistory(code);
			for (const sheet of history) {
				const authors = this.getUniqueAuthors(sheet);
				if (authors.includes(authorName)) {
					contributions.push({ code, sheet });
				}
			}
		}

		return contributions.sort(
			(a, b) =>
				new Date(b.sheet.data.commitDate).getTime() -
				new Date(a.sheet.data.commitDate).getTime(),
		);
	};
}

/** Factory function to create collection from repository data */
export function createSpritesheetsCollection(
	data: SpritesheetsMap,
	characters?: CharactersMap,
	contributors?: ContributorsMap,
): SpritesheetsCollection {
	return new SpritesheetsCollection(data, characters, contributors);
}
