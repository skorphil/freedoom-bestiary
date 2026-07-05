import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ContributionRepository } from "../repository/ContributionRepository";

describe("ContributionRepository", () => {
	const testUrl = "https://example.com/sprite.png";
	const mockContributions = {
		[testUrl]: [
			{
				contributorId: "test-artist",
				relation: "Artist",
			},
		],
	};

	beforeEach(() => {
		ContributionRepository.setData(mockContributions as any);
	});

	afterEach(() => {
		ContributionRepository.reset();
	});

	test("getContribution returns contributions for existing sprite", () => {
		const contributions = ContributionRepository.getContribution(testUrl);
		expect(contributions).toBeArray();
		expect(contributions.length).toBe(1);
		expect(contributions[0]?.contributorId).toBe("test-artist");
	});

	test("getContribution returns empty array for non-existent sprite", () => {
		const contributions = ContributionRepository.getContribution(
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

		ContributionRepository.addContribution(newUrl, newContribution);

		const contributions = ContributionRepository.getContribution(newUrl);
		expect(contributions).toContainEqual(newContribution);
	});
});
