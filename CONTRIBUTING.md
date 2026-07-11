Contributions to the project are highly welcome. Please submit PR or start discussion in `issues`.

## Tech

- **Bun** — Fast JavaScript runtime and package manager
- **React Router v8** — Framework with SSG (Static Site Generation)
- **Sharp** — High-performance image processing (replaces ImageMagick)

## Quick Start

1. [Install Bun](https://bun.sh/docs/installation)
2. Install dependencies: `bun install --frozen-lockfile`

```bash
# Start dev server for website
bun run dev:web

# Run tests across all packages
bun test
```

Code style: [.oxfmtrc.json](.oxfmtrc.json), [.oxlintrc.json](.oxlintrc.json)

Formatter - [oxfmtrc](https://oxc.rs/docs/guide/usage/formatter.html)
Linter - [oxlintrc](https://oxc.rs/docs/guide/usage/linter.html)
VSCode plugin – [oxc-vscode](https://github.com/oxc-project/oxc-vscode)

## Definitions

- **Character version** (spritesheet) – Snapshot of specific character in git commit, were any changes to any character's sprites were made. _Character version_ contains all sprites of character (both updated and old) in cases if only some of sprites were changed. _Character version_ is self-sufficient, meaning that it is possible to build all character's animations using single _character version_. Character version represented with spritesheet .webp file and additional meta-information, such as sprites' coordinates on spritesheet, contributors per sprite etc: [zod schema](packages/database/schema/spritesheet.ts)

## Architecture Overview

`freedoom-bestiary` is a bun monorepo, containing multiple packages, for different tasks of this project.

- `historical-parser` - set of scripts to parse and organize all character's sprites (including historical) from
  local git copies of [freedoom](https://github.com/freedoom/freedoom) and [attic](https://github.com/freedoom/attic).
  It is intended to use once for initial historical sprites parsing.

- `spritesheet-generator` - set of scripts which generates spritesheets for every character version.

- `web` - public SSG gallery for presenting a collection of animations for freedoom characters,
  including historical ones.

- `realtime-parser` (not implemented) - set of scripts to continuously watch for changes in [freedoom github](https://github.com/freedoom/freedoom).
  It updates collection of sprite versions. And eventually trigger `web` to be rebuild and re-deployed

- `sprite-collection` - organized collection of spritesheets and metadata, for all characters' animations.
  The resulting files used by `web` package as underlying data

## How animations are built

Spritesheets per each character version are generated on server with `spritesheet-generator`
Animations are built on a client (`web`) at a runtime with `canvas API`. Spritesheets and structured animation data (frame sequences, timings) used as a source data for client scripts.

This approach chosen for several reasons:

- To allow independent modification and development of web gallery.
  It is expected that presentational logic can evolve (adding more angles, changing the way to switch between states or angles etc).
  So it is needed to have a raw graphic data which allow to create various animations without the need to re-process all
  raw data. This is why using pre-rendered animations are bad idea - in case of changes it will require to re-render all of animations.

- To minimize amount of files for git tracking. Bundling individual sprites sprites in spritesheets will reduce number of files.

- To simplify logic. Bundling to spritesheets will allow logical grouping of related sprites which will simplify animation-rendering logic.
  For example, single spritesheet can group all frames for a single version of a character, which conveniently encapsulates animation-showing
  logic around single file

- To create independent collection. Having sprites copies inside this project reduce dependency
  on a freedoom source code, for example in case of git provider or url changes.
  This is why having copies chosen over using freedoom's original sprites' urls
