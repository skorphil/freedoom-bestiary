Contributions to the project are highly welcome. Please submit PR or start discussion in `issues`.


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
Animations are built on a client (`web`) at a runtime. Spritesheets and structured animation data (frame sequences, timings)
used as a source data for client scripts. This approach chosen for several reasons:

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
