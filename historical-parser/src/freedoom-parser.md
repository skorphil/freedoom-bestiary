---
jupyter:
  jupytext:
    custom_cell_magics: kql
    text_representation:
      extension: .md
      format_name: markdown
      format_version: "1.3"
      jupytext_version: 1.11.2
  kernelspec:
    display_name: Deno
    language: typescript
    name: deno
---

```typescript
// Enable Deno Kernel to run this notebook
```

Notebook looks for enemies sprites in existing
https://github.com/freedoom/freedoom commits and saves them in structured way
with commit metadata (to identify authors and creation dates)

```typescript
// Clone the repository to avoid rate limits and increase speed of parsing
const cloneCmd = new Deno.Command("git", {
  args: [
    "clone",
    "--bare",
    "https://github.com/freedoom/freedoom.git",
    "freedoom.git",
  ],
});

cloneCmd.outputSync();
```

```typescript
// Run with: deno run --allow-read --allow-write --allow-run scan_all_sprites.ts
import { TextLineStream } from "https://deno.land/std@0.224.0/streams/mod.ts";

const SCAN_CONFIG = {
  repoPath: "freedoom.git",
  githubUrl: "https://github.com/freedoom/freedoom",
  spritesJsonPath: "../sprites.json",
};

async function getSnapshotFiles(
  sha: string,
  fileRegex: RegExp,
): Promise<string[]> {
  const cmd = new Deno.Command("git", {
    args: [
      "--git-dir",
      SCAN_CONFIG.repoPath,
      "ls-tree",
      "-r",
      "--name-only",
      sha,
    ],
    stdout: "piped",
  });
  const { stdout } = await cmd.output();
  const output = new TextDecoder().decode(stdout);
  return output
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && fileRegex.test(s));
}

async function getSnapshotEntries(
  sha: string,
): Promise<Array<{ path: string; mode: string }>> {
  const cmd = new Deno.Command("git", {
    args: ["--git-dir", SCAN_CONFIG.repoPath, "ls-tree", "-r", sha],
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
}

async function scanSprite(code: string): Promise<void> {
  const fileRegex = new RegExp(
    `(?:^|[\\/])${code}([a-z])(\\d).*?\\.(png|gif)$`,
    "i",
  );
  const outputFile = `sprites/${code}.json`;
  console.log(`\n========================================`);
  console.log(`Scanning sprite: ${code} -> ${outputFile}`);
  console.log(`========================================`);

  const cmd = new Deno.Command("git", {
    args: [
      "--git-dir",
      SCAN_CONFIG.repoPath,
      "log",
      "--name-status",
      "--pretty=format:__COMMIT__|%H|%cd|%an|%s",
      "--date=iso-strict",
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
    if (commit && commit.changesMap.size > 0) {
      const allEntries = (await getSnapshotEntries(commit.sha))
        .filter((e) => fileRegex.test(e.path) && e.mode !== "120000");
      const mergedFiles: FileEntry[] = allEntries.map((e) => {
        const status = commit.changesMap.get(e.path) || "Existing";
        return {
          path: e.path,
          status,
          url: `${SCAN_CONFIG.githubUrl}/blob/${commit.sha}/${e.path}`,
        };
      });
      results.push({
        sha: commit.sha,
        date: commit.date,
        author: commit.author,
        message: commit.message,
        files: mergedFiles,
        id: `${commit.sha}--${commit.date}`,
      });
      matchCount++;
    }
  };

  for await (const line of lines) {
    if (line.startsWith("__COMMIT__|")) {
      if (currentCommit) await finishCommit(currentCommit);
      const parts = line.split("|");
      currentCommit = {
        sha: parts[1],
        date: parts[2],
        author: parts[3],
        message: parts.slice(4).join("|"),
        changesMap: new Map<string, string>(),
      };
      commitCount++;
    } else if (currentCommit && line.trim().length > 0) {
      // name-status format: "M\tpath" or "A\tpath" or "T\tpath" or "D\tpath"
      const sepIdx = line.indexOf("\t");
      if (sepIdx === -1) continue;
      const status = line.slice(0, sepIdx);
      const path = line.slice(sepIdx + 1).trim();
      if (fileRegex.test(path)) {
        currentCommit.changesMap.set(path, status);
      }
    }
  }
  if (currentCommit) await finishCommit(currentCommit);

  await Deno.writeTextFile(outputFile, JSON.stringify(results, null, 2));
  console.log(
    `Done ${code}: scanned ${commitCount} commits, ${matchCount} matched -> ${outputFile}`,
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
  console.log("\nAll sprites scanned.");
}

await main();
```
