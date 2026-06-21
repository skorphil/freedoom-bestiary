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

Generates animated WebP sprites from the `scan_results_*.json` files produced by
`freedoom-parser.ipynb`. Reads the scan output, downloads the referenced frames,
and renders centered, upscaled, lossless WebP animations using ImageMagick.

```typescript
// Run with: deno run --allow-read --allow-write --allow-net --allow-run generate_animations.ts

import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const ANIM_CONFIG = {
  spritesJsonPath: "../sprites.json",
  delay: 8,
  concurrency: 5,
};

interface FileEntry {
  path: string;
  status: string;
  url: string;
}

interface CommitEntry {
  id?: string; // Optional unique ID from the scan script
  sha: string;
  date: string;
  files: FileEntry[];
}

function getSpriteRegex(code: string): RegExp {
  // (?:^|[\\/]) -> Start of string OR a directory separator (ignores parent folders)
  // <code>       -> The sprite name prefix
  // ([a-z])     -> Group 1: The frame letter (A, B, C...)
  // (\d)        -> Group 2: The primary angle digit (0-8)
  // .*?         -> Non-greedy match for extra chars (like 'a8' in CYBRa2a8)
  // \.(png|gif) -> Extension
  return new RegExp(`(?:^|[\\/])${code}([a-z])(\\d).*?\\.(png|gif)$`, "i");
}

async function checkImageMagick() {
  try {
    const cmd = new Deno.Command("magick", { args: ["-version"] });
    const { success } = await cmd.output();
    if (!success) throw new Error();
  } catch {
    console.error("❌ Error: ImageMagick ('magick') not found.");
    Deno.exit(1);
  }
}

// --- Image Utils ---

async function getMaxDimensions(
  folderPath: string,
): Promise<{ w: number; h: number }> {
  // Use ImageMagick to get dimensions of all images in the folder
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

function getRawUrl(blobUrl: string): string {
  // Convert GitHub blob URL to raw content URL
  return blobUrl
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/blob/", "/");
}

function isValidImageHeader(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  // GIF Header (GIF8)
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return true;
  // PNG Header (‰PNG)
  if (
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47
  ) return true;
  return false;
}

async function downloadRealImage(
  url: string,
  depth = 0,
): Promise<Uint8Array | null> {
  if (depth > 3) return null; // Prevent infinite redirects
  const res = await fetch(url);
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  const data = new Uint8Array(buffer);

  if (isValidImageHeader(data)) return data;

  // Handle LFS pointers or redirects disguised as text files
  try {
    const textContent = new TextDecoder().decode(data).trim();
    if (textContent.length < 500 && !textContent.includes("\0")) {
      const currentUrlObj = new URL(url);
      const targetUrl = new URL(textContent, new URL(".", currentUrlObj)).href;
      if (targetUrl !== url) return downloadRealImage(targetUrl, depth + 1);
    }
  } catch { /* ignore */ }
  return null;
}

function getAnimationSequence(files: FileEntry[], regex: RegExp) {
  const frames = new Map<string, FileEntry>();

  for (const file of files) {
    const match = file.path.match(regex);
    if (!match) continue;

    // Group 1: Frame letter (A, B...)
    // Group 2: Angle (1-8, 0)
    const letter = match[1].toUpperCase();
    const angle = parseInt(match[2], 10);

    if (frames.has(letter)) {
      const existing = frames.get(letter)!;
      const existingMatch = existing.path.match(regex)!;
      const existingAngle = parseInt(existingMatch[2], 10);

      // Logic: Prefer angle 1 (front view) or angle 0 (omnidirectional)
      // If we have a side view (not 1 or 0), and find a front view (1), replace it.
      if (existingAngle !== 1 && angle === 1) {
        frames.set(letter, file);
      } // If we have a side view, don't have a front view, but find an omni view (0), take it.
      else if (existingAngle !== 1 && existingAngle !== 0 && angle === 0) {
        frames.set(letter, file);
      }
    } else {
      frames.set(letter, file);
    }
  }

  // Sort frames alphabetically (A, B, C...)
  return Array.from(frames.keys()).sort().map((key) => frames.get(key)!);
}

// --- Main Processing ---

async function processCommit(
  commit: CommitEntry,
  code: string,
  regex: RegExp,
  outputDir: string,
  tempDir: string,
) {
  // Use the unique ID generated by scan script, or fallback to SHA.
  // Sanitize for filename safety.
  const uniqueId = commit.id || commit.sha;
  const safeId = uniqueId.replace(/[^a-z0-9-]/gi, "_").slice(0, 100);

  const sequence = getAnimationSequence(commit.files, regex);

  if (sequence.length === 0) return;

  const commitTempDir = join(tempDir, safeId);
  await ensureDir(commitTempDir);

  let validFramesCount = 0;

  try {
    let index = 0;
    for (const file of sequence) {
      const rawUrl = getRawUrl(file.url);
      const ext = file.path.split(".").pop() || "png";
      const localName = `${String(index).padStart(3, "0")}.${ext}`;
      const localPath = join(commitTempDir, localName);

      const imageBuffer = await downloadRealImage(rawUrl);
      if (!imageBuffer) continue;

      await Deno.writeFile(localPath, imageBuffer);
      validFramesCount++;
      index++;
    }

    if (validFramesCount < 2) return;

    // 1. Calculate Dimensions (so we can center/extent properly)
    const { w, h } = await getMaxDimensions(commitTempDir);

    if (w === 0 || h === 0) {
      console.warn(`Could not determine dimensions for ${safeId}`);
      return;
    }

    const outputFilename = `${code}-${safeId}.webp`;
    const outputPath = join(outputDir, outputFilename);

    // 2. Build ImageMagick Command
    const magickArgs = [
      "-delay",
      String(ANIM_CONFIG.delay),
      "-dispose",
      "2", // Clear frame before rendering next (prevents ghosting)
      "-background",
      "none",
      "-loop",
      "0",
      join(commitTempDir, "*"),

      // Cleanup: Remove cyan background if present (common in Doom sprites)
      "-transparent",
      "cyan",

      // Alignment: Center at the bottom
      "+repage",
      "-gravity",
      "South",
      "-extent",
      `${w}x${h}`,

      // Upscaling: 400% Nearest Neighbor (pixel-art style)
      "-sample",
      "400%",

      // Output Format: Lossless WebP
      "-define",
      "webp:lossless=true",
      outputPath,
    ];

    const cmd = new Deno.Command("magick", { args: magickArgs });
    const { success, stderr } = await cmd.output();

    if (!success) {
      throw new Error(new TextDecoder().decode(stderr));
    }

    console.log(
      `Generated: ${outputFilename} (${validFramesCount} frames, Size: ${
        w * 4
      }x${h * 4})`,
    );
  } catch (err: any) {
    console.error(`Error processing ${safeId}:`, err.message);
  } finally {
    // Cleanup temp files for this commit
    try {
      await Deno.remove(commitTempDir, { recursive: true });
    } catch { /* ignore */ }
  }
}

async function main() {
  await checkImageMagick();

  const spritesRaw = await Deno.readTextFile(ANIM_CONFIG.spritesJsonPath);
  const sprites: { name: string; sprite: string }[] = JSON.parse(spritesRaw);
  const uniqueCodes = Array.from(new Set(sprites.map((s) => s.sprite)));
  console.log(`Found ${uniqueCodes.length} unique sprite codes.`);

  for (const code of uniqueCodes) {
    const inputFile = `scan_results_${code}.json`;
    const outputDir = `webp_${code}`;
    const tempDir = `temp_frames_${code}`;
    let raw: string;
    try {
      raw = await Deno.readTextFile(inputFile);
    } catch {
      console.warn(`Skipping ${code}: missing ${inputFile}`);
      continue;
    }
    const commits: CommitEntry[] = JSON.parse(raw);
    console.log(
      `\nProcessing ${code}: ${commits.length} commit entries -> ${outputDir}`,
    );

    await ensureDir(outputDir);
    await ensureDir(tempDir);

    for (let i = 0; i < commits.length; i += ANIM_CONFIG.concurrency) {
      const chunk = commits.slice(i, i + ANIM_CONFIG.concurrency);
      const regex = getSpriteRegex(code);
      await Promise.all(
        chunk.map((c) => processCommit(c, code, regex, outputDir, tempDir)),
      );
    }

    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch { /* ignore */ }
  }

  console.log("\nAll Done!");
}

await main();
```
