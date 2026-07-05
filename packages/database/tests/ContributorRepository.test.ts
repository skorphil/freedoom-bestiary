import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { ContributorRepository } from "../repository/ContributorRepository";

describe("ContributorRepository", () => {
	const mockContributors = {
		"test-artist": {
			name: "Test Artist",
			aliases: ["Artist A", "T-Artist"],
			links: [],
		},
	};

	beforeEach(() => {
		ContributorRepository.setData(mockContributors as any);
	});

	afterEach(() => {
		ContributorRepository.reset();
	});

	test("getAllContributors returns all contributors", () => {
		const contributors = ContributorRepository.getAllContributors();
		expect(contributors).toBeDefined();
		expect(Object.keys(contributors).length).toBe(1);
		expect(contributors["test-artist"]).toBeDefined();
	});

	test("getContributorById returns a single contributor", () => {
		const contributor = ContributorRepository.getContributorById("test-artist");
		expect(contributor).toBeDefined();
		expect(contributor.name).toBe("Test Artist");
	});

	test("getContributorById throws error for invalid id", () => {
		expect(() => {
			ContributorRepository.getContributorById("non-existent-id");
		}).toThrow("Contributor with id non-existent-id not found");
	});

	test("findByNameOrAlias finds by name", () => {
		const result = ContributorRepository.findByNameOrAlias("Test Artist");
		expect(result).toBeDefined();
		expect(result?.id).toBe("test-artist");
	});

	test("findByNameOrAlias finds by alias", () => {
		const result = ContributorRepository.findByNameOrAlias("Artist A");
		expect(result).toBeDefined();
		expect(result?.id).toBe("test-artist");
	});

	test("findByNameOrAlias returns null for unknown name", () => {
		const result = ContributorRepository.findByNameOrAlias("Unknown");
		expect(result).toBeNull();
	});

	test("findByNameOrAlias handles undefined/null", () => {
		// @ts-expect-error
		expect(ContributorRepository.findByNameOrAlias(undefined)).toBeNull();
		// @ts-expect-error
		expect(ContributorRepository.findByNameOrAlias(null)).toBeNull();
	});
});
