// Run with: deno run --allow-read --allow-write --allow-run src/build-animations.ts
//
// Generates per-version, per-animation, per-angle animated WebP sprites
// from the historical commit data in src/sprite-versions/ and the
// animation definitions in sprites.json. Writes:
//   out/animations/<CODE>.<ANIM>.<ANGLE>.<SHORT_SHA>.webp
//   out/animations.json
//
// Sprite images are read directly from local bare git clones
// (freedoom.git, attic.git) via `git show <sha>:<path>` rather than
// fetching from GitHub. Much faster; no --allow-net needed.

import { ensureDir } from "@std/fs/ensure-dir";
import { join } from "@std/path";

const REPO_ROOT = new URL("../", import.meta.url).pathname;

const CONFIG = {
  spritesJsonPath: join(REPO_ROOT, "sprites.json"),
  versionsDir: join(REPO_ROOT, "src", "sprite-versions"),
  outDir: join(REPO_ROOT, "out"),
  animationsDirName: "animations",
  animationsJsonName: "animations.json",
  delay: 20,
  scale: "100%",
  concurrency: 10,
  // Local bare clones available on disk. Keyed by the GitHub repo owner/name
  // portion of blob URLs in src/sprite-versions/*.json.
  bareRepos: {
    "freedoom/freedoom": join(REPO_ROOT, "src", "freedoom.git"),
    "freedoom/attic": join(REPO_ROOT, "src", "attic.git"),
  },
};

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

interface SpriteDef {
  name: string;
  sprite: string;
  [anim: string]: string[] | string | undefined;
}

interface AngleEntry {
  angle: number;
  webp: string;
}

interface AnimationEntry {
  angles: AngleEntry[];
}

interface VersionEntry {
  date: string;
  author: string;
  message: string;
  gitUrl: string;
  sha: string;
  animations: Record<string, AnimationEntry>;
}

type AnimationsFile = Record<string, VersionEntry[]>;

const ANIMATION_KEYS = [
  "idling",
  "chasing",
  "attacking",
  "hurting",
  "dying",
  "gibbing",
];

// --- Utilities ---

function getBasename(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1];
}

function getAngleRegex(code: string): RegExp {
  // <code><letter><digit> optionally followed by extra chars (e.g. CYBRa2a8),
  // then .png or .gif. Case-insensitive.
  return new RegExp(`^${code}[a-z](\\d).*?\\.(png|gif)$`, "i");
}

function getFrameRegex(code: string, letter: string, angle: number): RegExp {
  return new RegExp(`^${code}${letter}${angle}.*?\\.(png|gif)$`, "i");
}

function getRawUrl(blobUrl: string): string {
  return blobUrl
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/blob/", "/");
}

// Parses a blob URL like
//   https://github.com/freedoom/freedoom/blob/<sha>/sprites/bos2a1.png
// into { repo: "freedoom/freedoom", sha, path: "sprites/bos2a1.png" }.
// Returns null if the URL doesn't match the expected shape.
function parseBlobUrl(
  url: string,
): { repo: string; sha: string; path: string } | null {
  const m = url.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([0-9a-f]+)\/(.+)$/i,
  );
  if (!m) return null;
  return { repo: `${m[1]}/${m[2]}`, sha: m[3], path: m[4] };
}

// Reads a file at `<sha>:<path>` from a local bare git clone. Returns
// null when the blob is missing or the repo isn't available locally.
async function readGitBlob(
  bareRepoPath: string,
  sha: string,
  path: string,
): Promise<Uint8Array | null> {
  try {
    const cmd = new Deno.Command("git", {
      args: ["show", `${sha}:${path}`],
      cwd: bareRepoPath,
    });
    const { success, stdout } = await cmd.output();
    if (!success) return null;
    return new Uint8Array(stdout);
  } catch {
    return null;
  }
}

// Loads a sprite frame from the matching local bare clone, falling
// back to the GitHub raw URL when the blob isn't available locally.
async function loadSpriteImage(
  url: string,
): Promise<{ data: Uint8Array; ext: string } | null> {
  const parsed = parseBlobUrl(url);
  const extMatch = url.match(/\.(png|gif)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : "png";

  if (parsed) {
    const bareRepoPath = (CONFIG.bareRepos as Record<string, string>)[
      parsed.repo
    ];
    if (bareRepoPath) {
      const data = await readGitBlob(bareRepoPath, parsed.sha, parsed.path);
      if (data && data.length > 0) return { data, ext };
    }
  }

  // Fallback: fetch the raw file from GitHub. Requires --allow-net.
  try {
    const res = await fetch(getRawUrl(url));
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return { data: new Uint8Array(buf), ext };
  } catch {
    return null;
  }
}

async function checkImageMagick(): Promise<void> {
  try {
    const cmd = new Deno.Command("magick", { args: ["-version"] });
    const { success } = await cmd.output();
    if (!success) throw new Error();
  } catch {
    console.error("Error: ImageMagick ('magick') not found.");
    Deno.exit(1);
  }
}

function findFileForFrame(
  files: VersionFile[],
  regex: RegExp,
): VersionFile | undefined {
  for (const file of files) {
    if (regex.test(file.name)) return file;
  }
  return undefined;
}

// --- Image rendering ---

async function getMaxDimensions(
  folderPath: string,
): Promise<{ w: number; h: number }> {
  const cmd = new Deno.Command("magick", {
    args: ["identify", "-format", "%w,%h\n", join(folderPath, "*")],
  });
  const { stdout } = await cmd.output();
  const output = new TextDecoder().decode(stdout).trim();
  let maxW = 0;
  let maxH = 0;
  for (const line of output.split("\n")) {
    const parts = line.split(",");
    if (parts.length < 2) continue;
    const w = parseInt(parts[0], 10);
    const h = parseInt(parts[1], 10);
    if (!isNaN(w) && w > maxW) maxW = w;
    if (!isNaN(h) && h > maxH) maxH = h;
  }
  return { w: maxW, h: maxH };
}

async function renderAnimation(
  framePaths: string[],
  outputPath: string,
): Promise<{ w: number; h: number; frames: number }> {
  const tmpDir = outputPath + ".frames";
  await ensureDir(tmpDir);
  try {
    // Copy / hard-link frames in order with stable names.
    for (let i = 0; i < framePaths.length; i++) {
      const dst = join(tmpDir, `${String(i).padStart(3, "0")}.png`);
      await Deno.copyFile(framePaths[i], dst);
    }

    const { w, h } = await getMaxDimensions(tmpDir);
    if (w === 0 || h === 0) {
      throw new Error("could not determine frame dimensions");
    }

    const args = [
      "-delay",
      String(CONFIG.delay),
      "-dispose",
      "2",
      "-background",
      "none",
      "-loop",
      "0",
      join(tmpDir, "*"),
      "-transparent",
      "cyan",
      "+repage",
      "-gravity",
      "South",
      "-extent",
      `${w}x${h}`,
      "-sample",
      CONFIG.scale,
      "-define",
      "webp:lossless=true",
      outputPath,
    ];
    const cmd = new Deno.Command("magick", { args });
    const { success, stderr } = await cmd.output();
    if (!success) {
      throw new Error(new TextDecoder().decode(stderr));
    }
    return { w, h, frames: framePaths.length };
  } finally {
    try {
      await Deno.remove(tmpDir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
}

// --- Version processing ---

interface RenderJob {
  code: string;
  anim: string;
  angle: number;
  shortSha: string;
  frameFiles: VersionFile[];
}

async function processRenderJob(
  job: RenderJob,
  outputDir: string,
): Promise<string | null> {
  const { code, anim, angle, shortSha, frameFiles } = job;
  const tempDownloadDir = join(
    CONFIG.outDir,
    `temp_${code}_${shortSha}_${anim}_${angle}`,
  );
  const outputFilename = `${code}.${anim}.${angle}.${shortSha}.webp`;
  const outputPath = join(outputDir, outputFilename);
  const relativePath = `out/animations/${outputFilename}`;

  await ensureDir(tempDownloadDir);
  const downloaded: string[] = [];
  try {
    let idx = 0;
    for (const file of frameFiles) {
      const image = await loadSpriteImage(file.url);
      if (!image) continue;
      const localName = `${String(idx).padStart(3, "0")}.${image.ext}`;
      const localPath = join(tempDownloadDir, localName);
      await Deno.writeFile(localPath, image.data);
      downloaded.push(localPath);
      idx++;
    }

    if (downloaded.length === 0) return null;

    const { w, h, frames } = await renderAnimation(downloaded, outputPath);
    console.log(
      `Generated: ${outputFilename} (${frames} frames, ${w * 4}x${h * 4})`,
    );
    return relativePath;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error rendering ${outputFilename}: ${msg}`);
    return null;
  } finally {
    try {
      await Deno.remove(tempDownloadDir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
}

// --- Main ---

async function main() {
  await checkImageMagick();
  await ensureDir(CONFIG.outDir);
  const animationsDir = join(CONFIG.outDir, CONFIG.animationsDirName);
  await ensureDir(animationsDir);

  const spritesRaw = await Deno.readTextFile(CONFIG.spritesJsonPath);
  const sprites: SpriteDef[] = JSON.parse(spritesRaw);

  const codes = new Set<string>();
  for (const s of sprites) codes.add(s.sprite);
  try {
    for await (const entry of Deno.readDir(CONFIG.versionsDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        codes.add(entry.name.replace(/\.json$/, ""));
      }
    }
  } catch (err) {
    console.error(`Cannot read ${CONFIG.versionsDir}:`, err);
    Deno.exit(1);
  }

  const result: AnimationsFile = {};

  for (const code of Array.from(codes).sort()) {
    const versionsPath = join(CONFIG.versionsDir, `${code}.json`);
    let versions: Version[];
    try {
      const raw = await Deno.readTextFile(versionsPath);
      versions = JSON.parse(raw) as Version[];
    } catch {
      console.warn(`Skipping ${code}: missing ${versionsPath}`);
      continue;
    }

    const spriteDef = sprites.find((s) => s.sprite === code);
    const anims: Record<string, string[]> = {};
    if (spriteDef) {
      for (const key of ANIMATION_KEYS) {
        const seq = spriteDef[key];
        if (Array.isArray(seq) && seq.length > 0) {
          anims[key] = seq.map((l) => l.toUpperCase());
        }
      }
    }

    console.log(
      `\n[${code}] ${versions.length} versions, animations: ${
        Object.keys(anims).join(", ") || "(none)"
      }`,
    );

    const versionEntries: VersionEntry[] = [];
    const angleRe = getAngleRegex(code);

    for (const version of versions) {
      const shortSha = version.sha.slice(0, 7);

      const angleSet = new Set<number>();
      for (const file of version.files) {
        const m = getBasename(file.name).match(angleRe);
        if (m) angleSet.add(parseInt(m[1], 10));
      }
      const angles = Array.from(angleSet).sort((a, b) => a - b);

      const jobs: RenderJob[] = [];
      for (const anim of Object.keys(anims)) {
        for (const angle of angles) {
          const letters = anims[anim];
          const frameFiles: VersionFile[] = [];
          let resolvedAny = false;
          for (const letter of letters) {
            const re = getFrameRegex(code, letter, angle);
            const f = findFileForFrame(version.files, re);
            if (f) {
              frameFiles.push(f);
              resolvedAny = true;
            }
          }
          if (!resolvedAny) {
            console.warn(
              `[${code} ${shortSha}] no frames for anim=${anim} angle=${angle}`,
            );
            continue;
          }
          jobs.push({
            code,
            anim,
            angle,
            shortSha,
            frameFiles,
          });
        }
      }

      const animationsRecord: Record<string, AnimationEntry> = {};
      for (let i = 0; i < jobs.length; i += CONFIG.concurrency) {
        const chunk = jobs.slice(i, i + CONFIG.concurrency);
        const results = await Promise.all(
          chunk.map((j) => processRenderJob(j, animationsDir)),
        );
        for (let j = 0; j < chunk.length; j++) {
          const job = chunk[j];
          const relPath = results[j];
          if (!relPath) continue;
          if (!animationsRecord[job.anim]) {
            animationsRecord[job.anim] = { angles: [] };
          }
          animationsRecord[job.anim].angles.push({
            angle: job.angle,
            webp: relPath,
          });
        }
      }

      for (const anim of Object.keys(animationsRecord)) {
        animationsRecord[anim].angles.sort((a, b) => a.angle - b.angle);
      }

      versionEntries.push({
        date: version.date,
        author: version.author,
        message: version.message,
        gitUrl: version.url,
        sha: version.sha,
        animations: animationsRecord,
      });
    }

    if (versionEntries.length > 0) {
      result[code] = versionEntries;
    }
  }

  const outPath = join(CONFIG.outDir, CONFIG.animationsJsonName);
  const tmpPath = `${outPath}.tmp`;
  await Deno.writeTextFile(tmpPath, JSON.stringify(result, null, 2));
  await Deno.rename(tmpPath, outPath);
  console.log(`\nWrote ${outPath}`);
  console.log("All Done!");
}

await main();
