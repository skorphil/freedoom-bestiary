---
jupyter:
  jupytext:
    text_representation:
      extension: .md
      format_name: markdown
      format_version: "1.3"
      jupytext_version: 1.19.3
  kernelspec:
    display_name: Deno
    language: typescript
    name: deno
---

```typescript
// Clone the repository to avoid rate limits and increase speed of parsing
const cloneCmd = new Deno.Command("git", {
  args: [
    "clone",
    "--bare",
    "https://github.com/freedoom/attic",
    "attic.git",
  ],
});

cloneCmd.outputSync();
```

```typescript
// Run with: deno run --allow-read --allow-write --allow-run scan_all_sprites_attic.ts
// Appends to the per-sprite files in sprites/ (shared with freedoom-parser).
// Attic differs from freedoom: status codes include R100 (rename), and
// entries are grouped per folder so the unique id is `<sha>--<folder-slug>`.

import { TextLineStream } from "https://deno.land/std@0.224.0/streams/mod.ts";

const SCAN_CONFIG = {
  repoPath: "attic.git",
  githubUrl: "https://github.com/freedoom/attic",
  spritesJsonPath: "../sprites.json",
  outputDir: "sprites",
};

interface FileEntry {
  path: string;
  status: string;
  url: string;
}

interface CommitResult {
  sha: string;
  date: string;
  author: string;
  message: string;
  files: FileEntry[];
  id: string;
  folder?: string;
}

/**
 * Helper: Runs git ls-tree scoped to a SPECIFIC folder at a SPECIFIC commit.
 * Attic stores assets in many subfolders (old/, sprite/, group/...); the
 * folder scope keeps each commit's "Existing" file list tight and avoids
 * pulling in unrelated branches' files.
 */
async function getSnapshotFiles(
  sha: string,
  folderPath: string,
  fileRegex: RegExp,
): Promise<string[]> {
  const cmd = new Deno.Command("git", {
    args: [
      "--git-dir",
      SCAN_CONFIG.repoPath,
      "ls-tree",
      "-r",
      "--name-only",
      "--full-name",
      sha,
      folderPath,
    ],
    stdout: "piped",
  });
  const { stdout } = await cmd.output();
  const output = new TextDecoder().decode(stdout);

  return output
    .split("\n")
    .map((s) => s.trim())
    .filter((s) =>
      s.length > 0 && fileRegex.test(s) && s.startsWith(folderPath)
    );
}

async function getSnapshotEntries(
  sha: string,
  folderPath: string,
): Promise<Array<{ path: string; mode: string }>> {
  const cmd = new Deno.Command("git", {
    args: [
      "--git-dir",
      SCAN_CONFIG.repoPath,
      "ls-tree",
      "-r",
      "--full-name",
      sha,
      folderPath,
    ],
    stdout: "piped",
  });
  const { stdout } = await cmd.output();
  return new TextDecoder().decode(stdout)
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => {
      const [meta, ...pathParts] = l.split("\t");
      const mode = meta.split(" ")[0];
      return { path: pathParts.join("\t"), mode };
    });
}

function getDirectory(path: string): string {
  const lastSlashIndex = path.lastIndexOf("/");
  if (lastSlashIndex === -1) return ".";
  return path.substring(0, lastSlashIndex);
}

function statusFirstChar(statusRaw: string): string {
  // Accept "M", "A", "D", "T" (single-char), or "R100" / "C75" (rename/copy).
  return statusRaw.charAt(0);
}

async function scanSprite(code: string): Promise<void> {
  const fileRegex = new RegExp(
    `(?:^|[\\/])${code}([a-z])(\\d).*?\\.(png|gif)$`,
    "i",
  );
  const outputFile = `${SCAN_CONFIG.outputDir}/${code}.json`;
  console.log(`\n========================================`);
  console.log(`Scanning sprite (attic): ${code} -> ${outputFile}`);
  console.log(`========================================`);

  const cmd = new Deno.Command("git", {
    args: [
      "--git-dir",
      SCAN_CONFIG.repoPath,
      "log",
      "--name-status",
      "--pretty=format:__COMMIT__|%H|%cd|%an|%s",
      "--date=iso-strict",
      "HEAD",
    ],
    stdout: "piped",
  });
  const process = cmd.spawn();
  const lines = process.stdout
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());

  const results: CommitResult[] = [];
  let currentCommit: {
    sha: string;
    date: string;
    author: string;
    message: string;
    changesMap: Map<string, string>;
  } | null = null;
  let commitCount = 0;
  let matchCount = 0;

  const finishCommit = async (commit: typeof currentCommit) => {
    if (!commit || commit.changesMap.size === 0) return;

    // Attic quirk: group changed files by exact directory so each folder
    // becomes its own scan entry. Otherwise one commit could touch many
    // unrelated sprite groups (old/, new/, sprite/, ...) and the merged
    // "Existing" snapshot would balloon.
    const changesByFolder = new Map<string, Map<string, string>>();
    for (const [path, status] of commit.changesMap) {
      const dir = getDirectory(path);
      if (!changesByFolder.has(dir)) changesByFolder.set(dir, new Map());
      changesByFolder.get(dir)!.set(path, status);
    }

    for (const [folder, folderChanges] of changesByFolder) {
      const allEntries = (await getSnapshotEntries(commit.sha, folder))
        .filter((e) =>
          e.path.startsWith(folder) && e.mode !== "120000" &&
          fileRegex.test(e.path)
        );
      if (allEntries.length === 0) continue;

      const mergedFiles: FileEntry[] = allEntries.map((e) => {
        const status = folderChanges.get(e.path) || "Existing";
        return {
          path: e.path,
          status,
          url: `${SCAN_CONFIG.githubUrl}/blob/${commit.sha}/${e.path}`,
        };
      });

      mergedFiles.sort((a, b) => {
        const aChanged = a.status !== "Existing";
        const bChanged = b.status !== "Existing";
        if (aChanged && !bChanged) return -1;
        if (!aChanged && bChanged) return 1;
        return a.path.localeCompare(b.path);
      });

      const folderSlug = folder.replace(/[^a-z0-9-]+/gi, "-");
      const uniqueId = `${commit.sha}--${folderSlug}`;

      results.push({
        sha: commit.sha,
        date: commit.date,
        author: commit.author,
        message: commit.message,
        files: mergedFiles,
        id: uniqueId,
        folder,
      });
      matchCount++;
    }
  };

  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("__COMMIT__|")) {
      await finishCommit(currentCommit);
      const parts = trimmed.split("|");
      currentCommit = {
        sha: parts[1],
        date: parts[2],
        author: parts[3],
        message: parts.slice(4).join("|"),
        changesMap: new Map<string, string>(),
      };
      commitCount++;
      if (commitCount % 500 === 0) {
        await Deno.stdout.write(
          new TextEncoder().encode(
            `\r⚡ [${code}] Scanned ${commitCount} commits...`,
          ),
        );
      }
      continue;
    }

    if (currentCommit) {
      const parts = trimmed.split("\t");
      // name-status format: "M\tpath", "A\tpath", "R100\told\tnew", etc.
      if (parts.length < 2) continue;
      const statusRaw = parts[0];
      const statusChar = statusFirstChar(statusRaw);

      // Pick the new path for renames/copies (3-column), else the path.
      const changedPath = parts.length >= 3 ? parts[2] : parts[1];

      if (!["A", "M", "R", "C"].includes(statusChar)) continue;
      if (fileRegex.test(changedPath)) {
        currentCommit.changesMap.set(changedPath, statusRaw);
      }
    }
  }
  await finishCommit(currentCommit);

  // Append (not overwrite) to the shared per-sprite file. De-dupe on id
  // because attic and freedoom can touch the same SHA in shared history.
  let existing: CommitResult[] = [];
  try {
    const raw = await Deno.readTextFile(outputFile);
    existing = JSON.parse(raw);
  } catch {
    // File doesn't exist yet — first run for this sprite.
  }
  const seen = new Set(existing.map((e) => e.id));
  const merged = existing.concat(results.filter((e) => !seen.has(e.id)));

  await Deno.writeTextFile(outputFile, JSON.stringify(merged, null, 2));
  console.log(
    `\nDone ${code}: scanned ${commitCount} commits, ${matchCount} matched -> ${outputFile} (${merged.length} total entries)`,
  );
}

async function main() {
  const spritesRaw = await Deno.readTextFile(SCAN_CONFIG.spritesJsonPath);
  const sprites: { name: string; sprite: string }[] = JSON.parse(spritesRaw);
  const uniqueCodes = Array.from(new Set(sprites.map((s) => s.sprite)));
  console.log(
    `Found ${uniqueCodes.length} unique sprite codes in ${SCAN_CONFIG.spritesJsonPath}`,
  );

  for (const code of uniqueCodes) {
    await scanSprite(code);
  }
  console.log("\nAll attic sprites scanned.");
}

await main();
```
