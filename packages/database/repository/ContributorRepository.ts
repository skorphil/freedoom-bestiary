import {
	type Contributor,
	ContributorSchema,
	type ContributorsMap,
	ContributorsMapSchema,
} from "../schema/contributor";
import { readJsoncSync, resolveDataPath, writeJsoncSync } from "../utils/jsonc";

const FILE_URL = resolveDataPath("../data/contributors.jsonc", import.meta.url);

let cachedData: ContributorsMap | null = null;

function loadData(): ContributorsMap {
	if (cachedData) return cachedData;
	const json = readJsoncSync(FILE_URL);
	cachedData = ContributorsMapSchema.parse(json);
	return cachedData;
}

/** Sets isolated mock data for testing */
function setData(data: ContributorsMap): void {
	cachedData = data;
}

/** Resets data to original production state */
function reset(): void {
	cachedData = null;
}

/** Returns all contributors' data */
function getAllContributors(): ContributorsMap {
	return loadData();
}

/** Returns single contributor's data by ID */
function getContributorById(contributorId: string): Contributor {
	const data = loadData();
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
function findByNameOrAlias(
	name: string,
): { id: string; contributor: Contributor } | null {
	if (!name) return null;
	const data = loadData();
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
async function addContributor(
	id: string,
	contributor: Contributor,
): Promise<void> {
	const data = loadData();
	const validatedContributor = ContributorSchema.parse(contributor);
	data[id] = validatedContributor;
	await save();
}

export const ContributorRepository = {
	setData,
	reset,
	getAllContributors,
	getContributorById,
	findByNameOrAlias,
	addContributor,
};

/** Persists current data to disk */
async function save(): Promise<void> {
	try {
		const data = loadData();
		writeJsoncSync(FILE_URL, data);
	} catch (error) {
		console.error(`Failed to write contributors to ${FILE_URL}:`, error);
	}
}
