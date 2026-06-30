import { FreedomParser, AtticParser } from "./BaseParser.ts";
import { VersionCombiner as Combiner } from "./VersionCombiner.ts";
import { AuthorResolver } from "./AuthorResolver.ts";
import { mkdir, lstat } from "node:fs/promises";
import { config } from "dotenv";
import { join } from "node:path";

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
    const list = await file.json() as Array<{ sprite?: string; doomName?: string }>;
    const codes = new Set<string>();
    for (const item of list) {
      if (item.doomName === "Spectre") {
        console.debug("Skipping Spectre as requested.");
        continue;
      }
      if (item && typeof item.sprite === "string") {
        codes.add(item.sprite.toUpperCase());
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
};

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

    const a = new AtticParser(atticRepo, code, resolver);
    const snapshotsA = await a.parse();
    atticResults[code] = snapshotsA;
  }

  if (opts.write) {
    const versionsDir = `${repoRoot}/sprite-versions`;

    async function writeJsonAtomic(path: string, data: unknown) {
      await Bun.write(path, JSON.stringify(data, null, 2));
    }

    try {
      await lstat(versionsDir);
    } catch (e: any) {
      if (e.code === "ENOENT") {
        await mkdir(versionsDir, { recursive: true });
      } else throw e;
    }

    for (const code of codes) {
      const comb = new Combiner(code);
      const combined = comb.combine(freedoomResults[code] ?? [], atticResults[code] ?? []);
      const outPath = `${versionsDir}/${code}.json`;
      console.debug("runAll: writing version for", code, "->", outPath);
      await writeJsonAtomic(outPath, combined);
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
  }).then((res) => {
    console.log("Parsing complete. Codes:", Object.keys(res.freedoom).length);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
