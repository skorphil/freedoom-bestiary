// Run with: deno run --allow-read --allow-write generate-sprite-versions.ts

import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");
const INPUT_DIR = join(REPO_ROOT, "sprites");
const OUTPUT_DIR = join(REPO_ROOT, "sprite-versions");

// ... (types and helper functions)

interface FileEntry {
  path: string;
  status: string;
  url: string;
}

interface CommitEntry {
  sha: string;
  date: string;
  author: string;
  message: string;
  files: FileEntry[];
  id: string;
}

interface VersionFile {
  name: string;
  url: string;
}

interface Version {
  date: string;
  files: VersionFile[];
  sha: string;
  url: string;
  author: string;
  message: string;
}

// A commit is a "real update" if it adds, modifies, renames, or type-changes
// any sprite file. "Existing" entries mean the file was unchanged in this commit.
const REAL_UPDATE_STATUSES = new Set(["A", "M", "T", "R100"]);

function isSpriteFilePath(code: string, path: string): boolean {
  // path looks like "sprites/bos2a1.png" or "sprites/wesley/bos2a1.gif"
  // We want anything whose basename starts with `<code>` + a frame letter + digit.
  const segments = path.split("/");
  const basename = segments[segments.length - 1];
  const re = new RegExp(`^${code}[a-z]\\d.*?\\.(png|gif)$`, "i");
  return re.test(basename);
}

function getFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1];
}

// Extracts "owner/repo" from a GitHub blob URL like
//   https://github.com/freedoom/attic/blob/<sha>/path
// Returns null if the URL doesn't match the expected shape.
function getRepoFromBlobUrl(url: string): string | null {
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\//i);
  return m ? `${m[1]}/${m[2]}` : null;
}

function deriveSpriteAuthor(commit: CommitEntry, path: string): string {
  // The sprite author is encoded in the path relative to the `sprites/`
  // directory, but the convention varies between the two repos we mirror.
  //
  // Observed path shapes in the data:
  //   sprites/<file>                                     -> commit author
  //   sprites/<author>/<file>                            -> <author>
  //     e.g. sprites/mouse/bos2...png                           -> mouse
  //   sprites/<author>/<sprite>/<file>                   -> <author>
  //     e.g. sprites/catoptromancy/hellknight/bos2a2c8.gif     -> catoptromancy
  //   <prefix>/sprites/<author>/<file>                   -> <author>
  //     e.g. catoptromancy/sprites/hellknight/bos2a1c1.gif     -> catoptromancy
  //
  // The author is therefore:
  //   - the segment immediately AFTER `sprites/` when `sprites/` is the
  //     first segment of the path (shapes 1-3), or
  //   - the segment immediately BEFORE `sprites/` when `sprites/` appears
  //     later in the path (shape 4), since in that layout the leading
  //     directory is the author/project prefix.
  //
  // If neither applies (no `sprites/` segment, or the relevant neighbour
  // is missing or is itself a file), fall back to the commit author.
  const segments = path.split("/");
  const spritesIdx = segments.indexOf("sprites");
  if (spritesIdx === -1) return commit.author;

  if (spritesIdx === 0) {
    // Shape 1-3: path starts with sprites/. Author is the first segment
    // after `sprites/`, if it's a directory (no extension).
    const next = segments[1];
    if (!next || next.includes(".")) return commit.author;
    return next;
  }

  // Shape 4: leading directory exists. That directory is the author prefix.
  return segments[spritesIdx - 1];
}

function buildVersions(code: string, commits: CommitEntry[]): Version[] {
  const versions: Version[] = [];

  for (const commit of commits) {
    const changed = commit.files.filter(
      (f) =>
        isSpriteFilePath(code, f.path) && REAL_UPDATE_STATUSES.has(f.status),
    );

    if (changed.length === 0) continue;

    // Include every sprite file for this code that exists at this commit
    // (changed or not) so consumers can render the full animation frame set.
    const allSpriteFiles = commit.files.filter(
      (f) => isSpriteFilePath(code, f.path) && f.url,
    );

    // Group files by sprite author so each version tracks its own author
    // instead of inheriting the commit author across mixed-author commits.
    const groups = new Map<string, FileEntry[]>();
    for (const file of allSpriteFiles) {
      const author = deriveSpriteAuthor(commit, file.path);
      if (!groups.has(author)) groups.set(author, []);
      groups.get(author)!.push(file);
    }

    for (const [author, files] of groups) {
      // Derive the source repo from the first file's blob URL so the
      // version-level url points to the correct repo (e.g. freedoom/attic
      // vs freedoom/freedoom). All files in a group share the same repo
      // because they live in the same commit on the same branch.
      const repo = getRepoFromBlobUrl(files[0].url) ?? "freedoom/freedoom";
      versions.push({
        date: commit.date,
        files: files.map((f) => ({ name: getFileName(f.path), url: f.url })),
        sha: commit.sha,
        url: `https://github.com/${repo}/commit/${commit.sha}`,
        author,
        message: commit.message,
      });
    }
  }

  return versions;
}

async function main() {
  const inputDir = INPUT_DIR;
  const outputDir = OUTPUT_DIR;

  try {
    await mkdir(outputDir, { recursive: true });
  } catch (_) {
    // already exists
  }

  let entries: string[];
  try {
    const dirEntries = await readdir(inputDir, { withFileTypes: true });
    entries = dirEntries
      .filter(e => e.isFile() && e.name.endsWith(".json"))
      .map(e => e.name);
  } catch (err) {
    console.error(`Cannot read ${inputDir}:`, err);
    process.exit(1);
  }

  entries.sort();

  for (const name of entries) {
    const code = name.replace(/\.json$/, "");
    const inputPath = join(inputDir, name);
    const outputPath = join(outputDir, `${code}.json`);

    const raw = await Bun.file(inputPath).text();
    const commits: CommitEntry[] = JSON.parse(raw);
    const versions = buildVersions(code, commits);

    await Bun.write(outputPath, JSON.stringify(versions, null, 2));
    console.log(
      `${code}: ${commits.length} commits -> ${versions.length} versions`,
    );
  }

  console.log(`\nWrote versions to ${outputDir}`);
}

await main();
