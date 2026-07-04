import { expect, test, describe } from "bun:test";
import { ContributionRepository } from "../repository/ContributionRepository";

describe("ContributionRepository", () => {
  const testUrl = "https://github.com/freedoom/freedoom/blob/57246cae8f7901d4bc63072f9632685d1e3b507d/sprites/possa1.png";

  test("getContribution returns contributions for existing sprite", () => {
    const contributions = ContributionRepository.getContribution(testUrl);
    expect(contributions).toBeArray();
    expect(contributions.length).toBeGreaterThan(0);
    expect(contributions[0]?.contributorId).toBe("simon-howard");
  });

  test("getContribution returns empty array for non-existent sprite", () => {
    const contributions = ContributionRepository.getContribution("https://non-existent.com/sprite.png");
    expect(contributions).toBeArray();
    expect(contributions.length).toBe(0);
  });

  test("addContribution adds a new contribution", () => {
    const newUrl = "https://example.com/new-sprite.png";
    const newContribution = {
      contributorId: "test-user",
      relation: "Artist"
    };

    ContributionRepository.addContribution(newUrl, newContribution);
    
    const contributions = ContributionRepository.getContribution(newUrl);
    expect(contributions).toContainEqual(newContribution);
  });
});
