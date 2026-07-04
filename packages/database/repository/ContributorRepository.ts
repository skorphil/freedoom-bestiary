import { writeFileSync } from "node:fs";
import { join } from "node:path";
import contributorsJson from "../data/contributors.jsonc"
import { ContributorsMapSchema, ContributorSchema, type Contributor, type ContributorsMap } from "../schema/contributor";
import * as JSONC from "comment-json";

/** Reads Contributor's data from local FS and returns typed data */
export class ContributorRepository {
  private static readonly FILE_PATH = join(
    import.meta.dirname,
    "../data/contributors.jsonc"
  );
  static data: ContributorsMap = ContributorsMapSchema.parse(contributorsJson)

  /** Returns all contributors' data */
  static getAllContributors(): ContributorsMap {
    return this.data
  }

  /** Returns single contributor's data by ID */
  static getContributorById(contributorId: string): Contributor {
    const contributor = this.data[contributorId]
    if (!contributor) {
      throw new Error(`Contributor with id ${contributorId} not found`)
    }
    return contributor
  }

  /**
   * Searches for a contributor by name or alias.
   * Returns the contributor ID and data if found.
   */
  static findByNameOrAlias(name: string): { id: string; contributor: Contributor } | null {
    const searchName = name.toLowerCase().trim();
    for (const [id, contributor] of Object.entries(this.data)) {
      if (contributor.name.toLowerCase() === searchName) {
        return { id, contributor };
      }
      if (contributor.aliases?.some(alias => alias.toLowerCase() === searchName)) {
        return { id, contributor };
      }
    }
    return null;
  }

  /** Adds a new contributor and persists to disk */
  static addContributor(id: string, contributor: Contributor): void {
    const validatedContributor = ContributorSchema.parse(contributor);
    if (this.data[id]) {
      // Update existing if needed, but for now we just skip or overwrite
      this.data[id] = validatedContributor;
    } else {
      this.data[id] = validatedContributor;
    }
    this.save();
  }

  /** Persists current data to disk */
  private static save(): void {
    try {
      const content = JSONC.stringify(this.data, null, 2);
      writeFileSync(this.FILE_PATH, content, "utf-8");
    } catch (error) {
      console.error(`Failed to write contributors to ${this.FILE_PATH}:`, error);
    }
  }
}
