import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type AuthorAlias = {
  name: string;
  aliases: string[];
};

type AuthorInfo = {
  name: string;
  relation: string;
};

type AuthorsData = {
  [url: string]: AuthorInfo[];
};

const rootDir = join(import.meta.dir, '..');
const aliasesPath = join(import.meta.dir, 'authors_aliases.json');
const authorsPath = join(rootDir, 'authors.json');

/**
 * Normalizes author names in authors.json based on authors_aliases.json
 */
function normalizeAuthors() {
  const aliases: AuthorAlias[] = JSON.parse(readFileSync(aliasesPath, 'utf8'));
  const authors: AuthorsData = JSON.parse(readFileSync(authorsPath, 'utf8'));

  // Create a map for fast alias lookup
  const aliasMap = new Map<string, string>();
  for (const entry of aliases) {
    for (const alias of entry.aliases) {
      aliasMap.set(alias.toLowerCase(), entry.name);
    }
    // Also map the canonical name to itself (case-insensitive)
    aliasMap.set(entry.name.toLowerCase(), entry.name);
  }

  let changeCount = 0;

  for (const url in authors) {
    for (const authorInfo of authors[url]) {
      const normalizedName = aliasMap.get(authorInfo.name.toLowerCase());
      if (normalizedName && normalizedName !== authorInfo.name) {
        authorInfo.name = normalizedName;
        changeCount++;
      }
    }
  }

  writeFileSync(authorsPath, JSON.stringify(authors, null, 2) + '\n');
  console.log(`Normalized ${changeCount} author names in authors.json`);
}

normalizeAuthors();
