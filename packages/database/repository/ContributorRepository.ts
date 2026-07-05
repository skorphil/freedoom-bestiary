import {
	type Contributor,
	ContributorSchema,
	type ContributorsMap,
	ContributorsMapSchema,
} from "../schema/contributor";
import { readJsoncSync, resolveDataPath, writeJsoncSync } from "../utils/jsonc";

const FILE_URL = resolveDataPath("../data/contributors.jsonc", import.meta.url);

/** Reads Contributor's data from local FS and returns typed data */
export class ContributorRepository {
	private static cachedData: ContributorsMap | null = null;

	private static loadData(): ContributorsMap {
		if (ContributorRepository.cachedData)
			return ContributorRepository.cachedData;
		const json = readJsoncSync(FILE_URL);
		ContributorRepository.cachedData = ContributorsMapSchema.parse(json);
		return ContributorRepository.cachedData;
	}

	/** Sets isolated mock data for testing */
	static setData(data: ContributorsMap): void {
		ContributorRepository.cachedData = data;
	}

	/** Resets data to original production state */
	static reset(): void {
		ContributorRepository.cachedData = null;
	}

	/** Returns all contributors' data */
	static getAllContributors(): ContributorsMap {
		return ContributorRepository.loadData();
	}

	/** Returns single contributor's data by ID */
	static getContributorById(contributorId: string): Contributor {
		const data = ContributorRepository.loadData();
		const contributor = data[contributorId];
		if (!contributor) {
			throw new Error(`Contributor with id ${contributorId} not found`);
		}
		return contributor;
	}

	/**
	 * Searches for a contributor by name or alias.
	 * Returns the contributor ID and data if found.
	 */
	static findByNameOrAlias(
		name: string,
	): { id: string; contributor: Contributor } | null {
		if (!name) return null;
		const data = ContributorRepository.loadData();
		const searchName = name.toLowerCase().trim();
		for (const [id, contributor] of Object.entries(data)) {
			if (contributor.name.toLowerCase() === searchName) {
				return { id, contributor };
			}
			if (
				contributor.aliases?.some((alias) => alias.toLowerCase() === searchName)
			) {
				return { id, contributor };
			}
		}
		return null;
	}

	/** Adds a new contributor and persists to disk */
	static async addContributor(
		id: string,
		contributor: Contributor,
	): Promise<void> {
		const data = ContributorRepository.loadData();
		const validatedContributor = ContributorSchema.parse(contributor);
		data[id] = validatedContributor;
		await ContributorRepository.save();
	}

	/** Persists current data to disk */
	private static async save(): Promise<void> {
		try {
			const data = ContributorRepository.loadData();
			writeJsoncSync(FILE_URL, data);
		} catch (error) {
			console.error(`Failed to write contributors to ${FILE_URL}:`, error);
		}
	}
}
