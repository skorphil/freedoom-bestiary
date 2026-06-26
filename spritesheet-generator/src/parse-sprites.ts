import { parseBlobUrl } from "./get-image.ts";
import { basename } from "node:path";
import type { GridCell, ParsedSprite, Version, VersionFile } from "./types.ts";

// Allow sprite codes to include digits (e.g. BOS2)
// Format 1: {code}{frame1}{angle1} (e.g. POSSA1)
// Format 2: {code}{frame1}{angle1}{frame2}{angle2} (e.g. POSSA1B1)
// Format 3: {code}{frame1}{angle1}{angle2} (e.g. TROOA2A8 or TROOA28)

/**
 * Parses a sprite filename into ParsedSprite objects.
 * 
 * The filename format is: {code}{frame1}{angle1}[{frame2}{angle2} | {angle2}].{extension}
 * For example: "POSSA1.png", "POSSA1B1.png", "TROOA2A8.gif", or "TROOA28.gif"
 * 
 * Note: If a file only contains one angle that has a conventional mirror (e.g., A2),
 * this function only returns that one angle. The caller (extractGridCells) is
 * responsible for filling in missing mirrored counterparts.
 * 
 * @param filename - The sprite filename to parse
 * @param code - The sprite code to match against (e.g., "POSS")
 * @returns An array of ParsedSprite objects, or an empty array if parsing fails
 */
export function parseSpriteName(
  filename: string,
  code: string,
): ParsedSprite[] {
  // filenames coming from historical-parser may include directory prefixes
  // (e.g. "sprites/possa1.gif"). Use basename before applying the regex.
  const nameOnly = basename(filename);
  
  // We use a dynamic regex based on the code to avoid ambiguity when the code contains digits (e.g. BOS2)
  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^(${escapedCode})([a-z])(\\d)(?:([a-z])?(\\d))?\\.(png|gif)$`, "i");
  
  const m = nameOnly.match(pattern);
  if (!m) return [];
  const [, , frame1, angle1Str, frame2, angle2Str] = m;

  const angle1 = parseInt(angle1Str, 10);
  if (Number.isNaN(angle1)) return [];

  const base: ParsedSprite = {
    frame: frame1.toUpperCase(),
    angle: angle1,
    mirror: false,
    sourceFile: filename,
  };

  if (angle2Str === undefined) {
    return [base];
  }

  const angle2 = parseInt(angle2Str, 10);
  if (Number.isNaN(angle2)) return [base];

  return [
    base,
    {
      frame: (frame2 || frame1).toUpperCase(),
      angle: angle2,
      mirror: false, // Second angle in filename is never an auto-mirror, it's explicitly provided
      sourceFile: filename,
    },
  ];
}

/**
 * Mirror mapping for Doom-style rotations.
 */
const MIRROR_MAP: Record<number, number> = {
  2: 8,
  3: 7,
  4: 6,
  6: 4,
  7: 3,
  8: 2,
};

/**
 * Extracts grid cells from version files for a specific sprite code.
 * Automatically generates mirrored counterparts for missing angles (2-8, 3-7, 4-6).
 * 
 * @param files - Array of version files to process
 * @param code - The sprite code to filter by
 * @returns An array of GridCell objects
 */
export function extractGridCells(
  files: VersionFile[],
  code: string,
): GridCell[] {
  const cells: GridCell[] = [];
  const seen = new Set<string>();

  // First pass: collect all explicitly defined sprites
  for (const file of files) {
    const parsed = parseSpriteName(file.name, code);
    for (const p of parsed) {
      cells.push({ ...p, file });
      seen.add(`${p.frame}_${p.angle}`);
    }
  }

  // Second pass: fill in missing mirrored counterparts
  const extraCells: GridCell[] = [];
  for (const cell of cells) {
    // Only auto-mirror if the cell wasn't already a mirrored part of a dual-angle file
    // and if it has a valid mirror angle.
    const mirrorAngle = MIRROR_MAP[cell.angle];
    if (mirrorAngle !== undefined) {
      const key = `${cell.frame}_${mirrorAngle}`;
      if (!seen.has(key)) {
        extraCells.push({
          frame: cell.frame,
          angle: mirrorAngle,
          mirror: true,
          sourceFile: cell.sourceFile,
          file: cell.file,
        });
        seen.add(key);
      }
    }
  }

  return [...cells, ...extraCells];
}

/**
 * Detects the source repository for a version based on its files.
 * 
 * @param version - The version to analyze
 * @returns The source repository ("freedoom", "attic", or "unknown")
 */
export function detectSource(
  version: Version,
): "freedoom" | "attic" | "unknown" {
  if (version.files.length === 0) return "unknown";

  const counts = new Map<"freedoom" | "attic" | "unknown", number>();
  for (const file of version.files) {
    const repo = parseBlobUrl(file.url)?.repo;
    let bucket: "freedoom" | "attic" | "unknown";
    if (repo === "freedoom/freedoom") bucket = "freedoom";
    else if (repo === "freedoom/attic") bucket = "attic";
    else bucket = "unknown";
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  let winner: "freedoom" | "attic" | "unknown" = "unknown";
  let best = -1;
  for (const [bucket, count] of counts) {
    if (count > best) {
      best = count;
      winner = bucket;
    }
  }
  return winner;
}
