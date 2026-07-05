import fs from "node:fs";
import path from "node:path";

// Helper to "parse" JSONC by removing comments and trailing commas (simple version)
function parseJsonc(content) {
	const json = content
		.replace(/\/\/.*$/gm, "")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/,(\s*[\]}])/g, "$1");
	return JSON.parse(json);
}

const contributorsPath =
	"/Users/philipp/Documents/GitHub/freedoom-bestiary/packages/database/data/contributors.jsonc";
const contributionsPath =
	"/Users/philipp/Documents/GitHub/freedoom-bestiary/packages/database/data/contributions.jsonc";

const contributorsRaw = fs.readFileSync(contributorsPath, "utf-8");
const contributors = parseJsonc(contributorsRaw);

const contributionsRaw = fs.readFileSync(contributionsPath, "utf-8");

// Build a map of name/alias -> id
const nameToId = new Map();
for (const [id, data] of Object.entries(contributors)) {
	nameToId.set(id.toLowerCase(), id); // Support IDs that are already correct
	nameToId.set(data.name.toLowerCase(), id);
	if (data.aliases) {
		for (const alias of data.aliases) {
			nameToId.set(alias.toLowerCase(), id);
		}
	}
}

// Simple regex replacement to keep the original formatting and comments
const updatedContributions = contributionsRaw.replace(
	/"contributorId":\s*"([^"]+)"/g,
	(match, name) => {
		const id = nameToId.get(name.toLowerCase());
		if (id) {
			return `"contributorId": "${id}"`;
		}
		console.warn(`Warning: No ID found for contributor name "${name}"`);
		return match;
	},
);

fs.writeFileSync(contributionsPath, updatedContributions);
console.log("Successfully updated contributions.jsonc");
