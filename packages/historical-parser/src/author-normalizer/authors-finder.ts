import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Normalizes authors by extracting unique names from authors.json
 */
const authorsJsonPath = join(__dirname, '..', 'authors.json');
const outputPath = join(__dirname, 'authors_list.json');

const authorsData = JSON.parse(readFileSync(authorsJsonPath, 'utf8'));

const uniqueNames = new Set<string>();

for (const spriteEntries of Object.values(authorsData)) {
  if (Array.isArray(spriteEntries)) {
    for (const entry of spriteEntries as any[]) {
      if (entry.name) {
        uniqueNames.add(entry.name);
      }
    }
  }
}

const authorsList = Array.from(uniqueNames).sort((a, b) => 
  a.toLowerCase().localeCompare(b.toLowerCase())
);

writeFileSync(outputPath, JSON.stringify(authorsList, null, 2), 'utf8');

console.log(`Generated ${outputPath} with ${authorsList.length} unique authors.`);
