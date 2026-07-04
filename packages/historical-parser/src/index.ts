import { FreedomParser, AtticParser } from "./BaseParser.ts";
import { VersionCombiner as Combiner } from "./VersionCombiner.ts";
import { AuthorResolver } from "./AuthorResolver.ts";
import { lstat } from "node:fs/promises";
import { config } from "dotenv";
import { join } from "node:path";
import { ParsedCharacterRepository } from "../../database/repository/ParsedCharacterRepository.ts";
import type { ParsedSnapshot } from "../../database/schema/parsed-data.ts";
import type { CharacterVersionSnapshot } from "./types.ts";

// Load .env from the package directory
// @ts-ignore
const packageDir = import.meta.dir || ".";
const envPath = join(packageDir, "..", ".env");
console.debug(`Loading .env from: ${envPath}`);
config({ path: envPath });

if (!process.env.AI_TOKEN) {
  console.warn("AI_TOKEN not found in environment. Checked:", envPath);
}
if (!process.env.AI_GATEWAY_URL) {
  console.warn("AI_GATEWAY_URL not found in environment. Checked:", envPath);
}

async function loadCodesFromSpritesJson(): Promise<string[]> {
  // @ts-ignore
  const currentDir = import.meta.dir || ".";
  // The file is in the workspace root/sprites_meta/
  const spritesPath = join(currentDir, "..", "..", "..", "sprites_meta", "sprites_meta.json");
  try {
    // @ts-ignore
    const file = Bun.file(spritesPath);
    if (!(await file.exists())) {
      console.warn(`Metadata file not found at: ${spritesPath}. Using fallback codes.`);
      return fallbackCodes();
    }
    const list = await file.json() as Array<{ spriteCode?: string; doomName?: string }>;
    const codes = new Set<string>();
    for (const item of list) {
      if (item.doomName === "Spectre") {
        console.debug("Skipping Spectre as requested.");
        continue;
      }
      if (item && typeof item.spriteCode === "string") {
        codes.add(item.spriteCode.toUpperCase());
      }
    }
    return Array.from(codes);
  } catch (e: any) {
    console.error(`Failed to load codes from ${spritesPath}:`, e.message);
    return fallbackCodes();
  }
}

function fallbackCodes() {
  return [
    "BOS2", "BOSS", "BSPI", "CPOS", "CYBR", "FATT", "HEAD", "KEEN", "PAIN", 
    "PLAY", "POSS", "SARG", "SKEL", "SKUL", "SPID", "SPOS", "TROO", "VILE"
  ];
}

export type RunOptions = {
  freedoomRepo?: string;
  atticRepo?: string;
  codes?: string[];
  outDir?: string; 
  write?: boolean;
  noAi?: boolean;
  noAttic?: boolean;
};

/**
 * Maps internal CharacterVersionSnapshot to ParsedSnapshot from database schema.
 */
function toParsedSnapshot(s: CharacterVersionSnapshot): ParsedSnapshot {
  console.debug(`Mapping snapshot ${s.commitSha} for ${s.commitSource}`);
  return {
    date: s.commitDate,
    message: s.commitMessage,
    source: s.commitSource,
    url: s.commitUrl,
    sha: s.commitSha,
    index: s.commitIndex,
    folder: s.folder,
    contributions: (s.authors || []).map(a => {
      if (!a.contributorId) {
        console.warn(`Empty contributorId for author ${a.name} in commit ${s.commitSha}`);
        throw new Error(`Missing contributorId for author ${a.name} in commit ${s.commitSha}. This should not happen.`);
      }
      return {
        contributorId: a.contributorId,
        relation: a.relation || "Contributor"
      };
    }),
    sprites: (s.sprites || []).map((sp, idx) => {
      return {
        name: sp.name.split("/").pop() || sp.name,
        url: sp.url,
        contributions: (sp.spriteAuthors || []).map(sa => {
          if (!sa.contributorId) {
            console.warn(`Empty contributorId for sprite author ${sa.name} in sprite ${sp.name} in commit ${s.commitSha}`);
            throw new Error(`Missing contributorId for sprite author ${sa.name} in sprite ${sp.name} in commit ${s.commitSha}. This should not happen.`);
          }
          return {
            contributorId: sa.contributorId,
            relation: sa.relation || "Contributor"
          };
        }),
        state: sp.spriteState,
        lastChangedDate: sp.lastChangedDate,
        index: idx,
        source: sp.source
      };
    })
  };
}

export async function runAll(opts: RunOptions = {}) {
  console.debug("runAll: starting with options:", opts);
  const repoRoot = opts.outDir ? opts.outDir : "src";
  const freedoomRepo = opts.freedoomRepo ?? "src/freedoom.git";
  const atticRepo = opts.atticRepo ?? "src/attic.git";
  const codes = opts.codes ?? await loadCodesFromSpritesJson();

  // Initialize AuthorResolver
  const resolver = new AuthorResolver({
    aiToken: process.env.AI_TOKEN,
    gatewayUrl: process.env.AI_GATEWAY_URL,
    noAi: opts.noAi,
    freedoomRepoPath: freedoomRepo,
  });
  await resolver.init();

  const freedoomResults: Record<string, any[]> = {};
  const atticResults: Record<string, any[]> = {};

  for (const code of codes) {
    console.debug(`runAll: processing code ${code}`);
    const f = new FreedomParser(freedoomRepo, code, resolver);
    const snapshotsF = await f.parse();
    freedoomResults[code] = snapshotsF;

    if (!opts.noAttic) {
      const a = new AtticParser(atticRepo, code, resolver);
      const snapshotsA = await a.parse();
      atticResults[code] = snapshotsA;
    } else {
      atticResults[code] = [];
    }
  }

  if (opts.write) {
    for (const code of codes) {
      const comb = new Combiner(code);
      const combined = comb.combine(freedoomResults[code] ?? [], atticResults[code] ?? []);
      
      console.debug(`runAll: storing ${combined.spriteVersions.length} versions for ${code} via repository`);
      
      // The combined results are sorted from newest to oldest in VersionCombiner.ts (reverse())
      // But Repository expects to append. So we should process them in chronological order.
      // Actually VersionCombiner.spriteVersions.reverse() makes it newest first.
      // ParsedCharacterRepository.appendSnapshot expects chronological appends.
      const chronologicalVersions = [...combined.spriteVersions].reverse();

      for (const v of chronologicalVersions) {
        const snapshot = toParsedSnapshot(v);
        // Debugging Zod validation
        try {
          await ParsedCharacterRepository.appendSnapshot(code, snapshot);
        } catch (e: any) {
          if (e.name === "ZodError") {
            console.error(`ZodError while appending snapshot for ${code} at ${v.commitSha}:`, JSON.stringify(e.errors, null, 2));
          } else {
            console.error(`Error appending snapshot for ${code} at ${v.commitSha}:`, e);
          }
          throw e;
        }
      }
    }

    // Save the author cache
    await resolver.saveCache();
  }

  return { freedoom: freedoomResults, attic: atticResults };
}

if (import.meta.main) {
  const args = new Map<string, string | boolean>();
  const rawArgs = process.argv.slice(2);
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === "--write") args.set("write", true);
    else if (a === "--no-ai") args.set("noAi", true);
    else if (a === "--no-attic") args.set("noAttic", true);
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
    noAi: Boolean(args.get("noAi")),
    noAttic: Boolean(args.get("noAttic")),
  }).then((res) => {
    console.log("Parsing complete. Codes:", Object.keys(res.freedoom).length);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
