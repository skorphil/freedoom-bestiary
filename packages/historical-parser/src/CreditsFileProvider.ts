/**
 * Simple parser for the Freedoom CREDITS file.
 * Format is:
 * N: Name
 * S: Handle
 * E: Email
 * D: Description of contributions
 */
export class CreditsFileProvider {
  private contributors: Contributor[] = [];

  constructor(content: string) {
    this.contributors = this.parse(content);
  }

  private parse(content: string): Contributor[] {
    const blocks = content.split(/\n\n+/);
    const result: Contributor[] = [];

    for (const block of blocks) {
      const contributor: Contributor = {
        name: "",
        handles: [],
        descriptions: [],
      };

      const lines = block.split("\n");
      for (const line of lines) {
        const match = line.match(/^([NSEWD]):\s*(.*)$/i);
        if (!match) continue;

        const type = match[1].toUpperCase();
        const value = match[2].trim();

        if (type === "N") contributor.name = value;
        if (type === "S") contributor.handles.push(value);
        if (type === "D") contributor.descriptions.push(value);
      }

      if (contributor.name || contributor.handles.length > 0) {
        result.push(contributor);
      }
    }
    return result;
  }

  /**
   * Finds authors by searching descriptions for keywords.
   * e.g. code "POSS" -> looks for "Zombieman" or "POSS"
   */
  getAuthorsForCode(code: string): string[] {
    const names = new Set<string>();
    const searchTerms = this.getSearchTerms(code);

    for (const contributor of this.contributors) {
      for (const desc of contributor.descriptions) {
        if (searchTerms.some(term => desc.toLowerCase().includes(term.toLowerCase()))) {
          names.add(contributor.handles[0] || contributor.name);
        }
      }
    }
    return Array.from(names);
  }

  private getSearchTerms(code: string): string[] {
    const map: Record<string, string[]> = {
      "POSS": ["Zombieman", "POSS"],
      "SPOS": ["Shotgunner", "SPOS"],
      "CYBR": ["Cyberdemon", "CYBR"],
      "CPOS": ["Chaingunner", "CPOS"],
      "SKEL": ["Revenant", "Dark Soldier", "SKEL"],
      "SSWV": ["Dark Soldier", "SSWV"],
      "PISG": ["Pistol", "PISG"],
      "SHTG": ["Shotgun", "SHTG"],
      // Add more as needed
    };
    return map[code] || [code];
  }
}

type Contributor = {
  name: string;
  handles: string[];
  descriptions: string[];
};
