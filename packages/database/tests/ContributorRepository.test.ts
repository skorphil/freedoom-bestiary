import { expect, test, describe } from "bun:test";
import { ContributorRepository } from "../repository/ContributorRepository";

describe("ContributorRepository", () => {
  test("getAllContributors returns all contributors", () => {
    const contributors = ContributorRepository.getAllContributors();
    expect(contributors).toBeDefined();
    expect(Object.keys(contributors).length).toBeGreaterThan(0);
    expect(contributors["simon-howard"]).toBeDefined();
  });

  test("getContributorById returns a single contributor", () => {
    const contributor = ContributorRepository.getContributorById("simon-howard");
    expect(contributor).toBeDefined();
    expect(contributor.name).toBe("Simon Howard");
  });

  test("getContributorById throws error for invalid id", () => {
    expect(() => {
      ContributorRepository.getContributorById("non-existent-id");
    }).toThrow("Contributor with id non-existent-id not found");
  });
});
