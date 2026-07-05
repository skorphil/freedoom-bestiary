import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	addContribution,
	getContribution,
	reset,
	setData,
} from "../repository/ContributionRepository";
import type { ContributionsMap } from "../schema/contribution";

describe("ContributionRepository", () => {
	const testUrl = "https://example.com/sprite.png";
	const mockContributions: ContributionsMap = {
		[testUrl]: [
			{
				contributorId: "test-artist",
				relation: "Artist",
			},
		],
	};

	beforeEach(() => {
		setData(mockContributions);
	});

	afterEach(() => {
		reset();
	});

	test("getContribution returns contributions for existing sprite", () => {
		const contributions = getContribution(testUrl);
		expect(contributions).toBeArray();
		expect(contributions.length).toBe(1);
		expect(contributions[0]?.contributorId).toBe("test-artist");
	});

	test("getContribution returns empty array for non-existent sprite", () => {
		const contributions = getContribution(
			"https://non-existent.com/sprite.png",
		);
		expect(contributions).toBeArray();
		expect(contributions.length).toBe(0);
	});

	test("addContribution adds a new contribution", () => {
		const newUrl = "https://example.com/new-sprite.png";
		const newContribution = {
			contributorId: "new-artist",
			relation: "Refinement",
		};

		addContribution(newUrl, newContribution);

		const contributions = getContribution(newUrl);
		expect(contributions).toContainEqual(newContribution);
	});
});
