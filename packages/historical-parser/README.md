@historical-parser

Scans the git history of the `freedoom/freedoom` and `freedoom/attic` repositories and produces per-commit sprite snapshots used to build version timelines.

## Prerequisites

1. **Bun** installed.
2. **Bare git clones** of both upstream repos inside `src/`:
   ```sh
   git clone --bare https://github.com/freedoom/freedoom src/freedoom.git
   git clone --bare https://github.com/freedoom/attic    src/attic.git
   ```

## Running

### Via bun (recommended)

From the `historical-parser/` directory:

```sh
bun run parse
```

This runs `src/index.ts --write`, which:
1. Scans all sprite codes from `sprites.json`
2. Parses `src/freedoom.git` and `src/attic.git` git history
3. Writes:
   - `src/freedoom-sprites.json` — raw snapshots per code from the freedoom repo
   - `src/attic-sprites.json` — raw snapshots per code from the attic repo
   - `src/sprite-versions/<CODE>.json` — combined version timeline per code


### CLI flags

| Flag | Description |
|---|---|
| `--write` | Write output files to disk. Omit for a dry-run that prints counts only. |
| `--codes=POSS,HEAD,TROO` | Comma-separated list of 4-char sprite codes to process. Defaults to all codes from `sprites.json`. |
| `--freedoom-repo=path` | Path to the `freedoom.git` bare clone. Defaults to `src/freedoom.git`. |
| `--attic-repo=path` | Path to the `attic.git` bare clone. Defaults to `src/attic.git`. |
| `--out=dir` | Output directory for JSON files. Defaults to `src/`. |

Examples:

```sh
# Dry-run (no files written)
bun run parse -- --no-write

# Single code
bun run --cwd historical-parser src/index.ts --write --codes=HEAD

# Custom repo paths
bun run --cwd historical-parser src/index.ts --write \
  --freedoom-repo=/data/freedoom.git \
  --attic-repo=/data/attic.git
```

### Run tests

```sh
bun test
```

## Programmatic usage

```ts
import { FreedomParser, AtticParser, VersionCombiner } from "./src/index.ts";
import type { CommitSnapshot, CharacterVersions } from "./src/index.ts";

// Parse a single code from freedoom
const fParser = new FreedomParser("src/freedoom.git", "POSS");
const freedomSnaps: CommitSnapshot[] = await fParser.parse();

// Parse the same code from attic
const aParser = new AtticParser("src/attic.git", "POSS");
const atticSnaps: CommitSnapshot[] = await aParser.parse();

// Combine into a version timeline
const combiner = new VersionCombiner("POSS");
const versions: CharacterVersions = combiner.combine(freedomSnaps, atticSnaps);
console.log(versions.spriteVersions.length, "versions found");

// Debug: get snapshot for a specific commit SHA
const snap = await fParser.getSnapshot("abc1234");
console.log(snap?.commitSprites.length, "sprites at that commit");
```

Or use the high-level `runAll` helper:

```ts
import { runAll } from "./src/index.ts";

const result = await runAll({
  codes: ["POSS", "HEAD"],
  write: true,                 // write JSON files to disk
  outDir: "src",               // optional, defaults to src/
  freedoomRepo: "src/freedoom.git",
  atticRepo: "src/attic.git",
});

console.log("freedoom snapshots for POSS:", result.freedoom["POSS"].length);
```

## Architecture

```
src/
  index.ts             Entry point — runAll() + CLI flag parsing
  GitReader.ts         All Bun.spawn git subprocess calls (I/O boundary)
  SpritePattern.ts     Sprite filename regex + frame-key extraction (pure)
  SpritePattern.ts     Also contains AuthorResolver — path → author name (pure)
  CommitLogScanner.ts  State-machine: git log --name-status → ScanUnit[]
  SnapshotBuilder.ts   ScanUnit + git ls-tree → CommitSnapshot
  BaseParser.ts        Abstract template-method base + FreedomParser + AtticParser
  VersionCombiner.ts   Merge freedoom + attic snapshots → CharacterVersions
  types.ts             Re-export hub for all public types and classes
```

### Component responsibilities

| Class | Role |
|---|---|
| `GitReader` | Sole git subprocess caller. Wraps `git log`, `git ls-tree`, `git cat-file`. |
| `SpritePattern` | Regex matching and frame-key extraction for one sprite code. No I/O. |
| `AuthorResolver` | Derives author from file path shape (4 patterns). No I/O. |
| `CommitLogScanner` | Parses log lines into `ScanUnit` objects. Attic variant groups by folder. |
| `SnapshotBuilder` | Calls `git ls-tree` per commit, resolves symlinks (freedoom), assigns author. |
| `FreedomParser` | Concrete parser: flat `/sprites` dir, symlinks followed, 1 unit/commit. |
| `AtticParser` | Concrete parser: author subfolders, no symlinks, N units/commit per folder. |
| `VersionCombiner` | Chronological merge, dedup by SHA, emit version only when a frame changes. |

### Data flow

```
freedoom.git ─┐
               ├─ FreedomParser ──► CommitSnapshot[] (freedoom-sprites.json)
sprites.json  ─┤                                                              ┐
               ├─ AtticParser ───► CommitSnapshot[] (attic-sprites.json)     ├─ VersionCombiner ─► CharacterVersions (sprite-versions/<CODE>.json)
attic.git ─────┘                                                              ┘
```

### Output file formats

**`src/freedoom-sprites.json` / `src/attic-sprites.json`**

```json
{
  "POSS": [
    {
      "commitDate": "2023-07-16T23:14:24-07:00",
      "commitAuthor": "Steven Elliott",
      "commitMessage": "png: Map color 255 to color 133",
      "commitSha": "57246cae...",
      "commitUrl": "https://github.com/freedoom/freedoom/commit/57246cae...",
      "commitSource": "freedoom",
      "commitSprites": [
        { "code": "POSS", "filename": "sprites/possa1.png", "url": "https://...blob/...", "status": "M", "authorName": "Steven Elliott" }
      ]
    }
  ]
}
```

**`src/sprite-versions/<CODE>.json`**

```json
{
  "code": "POSS",
  "spriteVersions": [
    {
      "commitDate": "2024-05-27T00:54:34+05:00",
      "commitMessage": "Add zombieman sprites",
      "commitSource": "attic",
      "commitUrl": "https://github.com/freedoom/attic/commit/3dac732...",
      "commitSha": "3dac732...",
      "sprites": [
        { "name": "sprites/possa1.gif", "url": "https://...blob/...", "spriteAuthor": "saint_of_killers", "spriteState": "new" }
      ]
    }
  ]
}
```

`spriteVersions` is ordered newest-first.

## Notes

- The parsers work offline — all data comes from local bare git clones.
- `GITHUB_TOKEN` in `.env` is vestigial from an earlier HTTP-API version; not required.
- Migrated from Deno to Bun — all Deno APIs replaced with Bun/Node equivalents.
