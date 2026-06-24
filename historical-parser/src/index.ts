export { FreedomParser, AtticParser } from "./BaseParser.ts";
export { VersionCombiner } from "./VersionCombiner.ts";

// Re-export types useful to consumers
export type { CommitSnapshot, CharacterVersions } from "./types.ts";

import { join } from "@std/path";
import { FreedomParser, AtticParser } from "./BaseParser.ts";
import { VersionCombiner as Combiner } from "./VersionCombiner.ts";

async function loadCodesFromSpritesJson(): Promise<string[]> {
  const spritesPath = join("./", "sprites.json");
  try {
    const raw = await Deno.readTextFile(spritesPath);
    const list = JSON.parse(raw) as Array<{ sprite?: string }>;
    const codes = new Set<string>();
    for (const item of list) {
      if (item && typeof item.sprite === "string") {
        codes.add(item.sprite.toUpperCase());
      }
    }
    return Array.from(codes);
  } catch (_e) {
    // fallback
    return [
      "POSS",
      "SPOS",
      "TROO",
      "SARG",
      "HEAD",
      "SKUL",
      "CYBR",
      "SPID",
      "BSPI",
    ];
  }
}

export type RunOptions = {
  freedoomRepo?: string;
  atticRepo?: string;
  codes?: string[];
  outDir?: string; // defaults to src/
  write?: boolean;
};

export async function runAll(opts: RunOptions = {}) {
  console.debug("runAll: starting with options:", opts);
  const repoRoot = opts.outDir ? opts.outDir : join("src");
  const freedoomRepo = opts.freedoomRepo ?? join("src", "freedoom.git");
  const atticRepo = opts.atticRepo ?? join("src", "attic.git");
  const codes = opts.codes ?? await loadCodesFromSpritesJson();
  console.debug("runAll: resolved repoRoot, freedoomRepo, atticRepo:", { repoRoot, freedoomRepo, atticRepo });
  console.debug("runAll: codes to process:", codes);

  const freedoomResults: Record<string, any[]> = {};
  const atticResults: Record<string, any[]> = {};

  for (const code of codes) {
    console.debug(`runAll: processing code ${code}`);
    const f = new FreedomParser(freedoomRepo, code);
    const snapshotsF = await f.parse();
    freedoomResults[code] = snapshotsF;
    console.debug(`runAll: ${code} freedoom snapshots:`, snapshotsF.length);

    const a = new AtticParser(atticRepo, code);
    const snapshotsA = await a.parse();
    atticResults[code] = snapshotsA;
    console.debug(`runAll: ${code} attic snapshots:`, snapshotsA.length);
  }

  if (opts.write) {
    console.debug("runAll: writing outputs to disk");
    // Ensure output directories exist and write files atomically
    const freedoomPath = join(repoRoot, "freedoom-sprites.json");
    const atticPath = join(repoRoot, "attic-sprites.json");
    const versionsDir = join(repoRoot, "sprite-versions");

    // write helper
    async function writeJsonAtomic(path: string, data: unknown) {
      const tmp = path + ".tmp";
      await Deno.writeTextFile(tmp, JSON.stringify(data, null, 2));
      await Deno.rename(tmp, path);
    }

    console.debug("runAll: writing freedoomPath:", freedoomPath);
    await writeJsonAtomic(freedoomPath, freedoomResults);
    console.debug("runAll: writing atticPath:", atticPath);
    await writeJsonAtomic(atticPath, atticResults);

    // per-code versions
    try {
      await Deno.lstat(versionsDir);
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        await Deno.mkdir(versionsDir, { recursive: true });
      } else throw e;
    }

    for (const code of codes) {
      const comb = new Combiner(code);
      const combined = comb.combine(freedoomResults[code] ?? [], atticResults[code] ?? []);
      const outPath = join(versionsDir, `${code}.json`);
      console.debug("runAll: writing version for", code, "->", outPath);
      await writeJsonAtomic(outPath, combined);
    }
  }

  return { freedoom: freedoomResults, attic: atticResults };
}

if (import.meta.main) {
  // simple CLI parsing
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < Deno.args.length; i++) {
    const a = Deno.args[i];
    if (a === "--write") args.set("write", true);
    else if (a.startsWith("--codes=")) args.set("codes", a.split("=")[1]);
    else if (a.startsWith("--freedoom-repo=")) args.set("freedoomRepo", a.split("=")[1]);
    else if (a.startsWith("--attic-repo=")) args.set("atticRepo", a.split("=")[1]);
    else if (a.startsWith("--out=")) args.set("outDir", a.split("=")[1]);
  }

  const codes = args.get("codes") ? (String(args.get("codes")).split(",").map(s=>s.trim().toUpperCase())) : undefined;

  runAll({
    freedoomRepo: args.get("freedoomRepo") as string | undefined,
    atticRepo: args.get("atticRepo") as string | undefined,
    codes,
    outDir: args.get("outDir") as string | undefined,
    write: Boolean(args.get("write")),
  }).then((res) => {
    console.log("Parsing complete. Codes:", Object.keys(res.freedoom).length);
    if (!Boolean(args.get("write"))) console.log("Dry-run: no files were written. Pass --write to persist JSON files.");
  }).catch((err) => {
    console.error(err);
    Deno.exit(1);
  });
}
