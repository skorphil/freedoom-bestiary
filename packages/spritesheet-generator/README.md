# @freedoom-bestiary/spritesheet-generator

A Bun-based tool for generating spritesheets from Freedoom sprite files. This package processes historical sprite data and creates optimized spritesheets for efficient rendering in web applications.

## Overview

The spritesheet generator transforms individual sprite images into compact spritesheets, making it easier to display Doom-style sprite animations in web browsers. It handles sprite parsing, layout optimization, image padding, and metadata generation.

## Architecture

The package consists of several core modules:

### Core Modules

1. **`index.ts`** - Main entry point and orchestration logic
   - Handles input/output operations
   - Manages the overall generation pipeline
   - Provides configuration management

2. **`parse-sprites.ts`** - Sprite name parsing and grid organization
   - Parses sprite filenames according to Doom conventions
   - Organizes sprites into grid layouts based on frames and angles
   - Detects sprite sources (freedoom vs attic)

3. **`get-image.ts`** - Image loading and retrieval
   - Loads sprite images from local repositories or remote URLs
   - Handles GitHub blob URLs and raw content fetching
   - Manages bare Git repository access

4. **`create-spritesheet.ts`** - Spritesheet creation and layout
   - Arranges sprites in grid format
   - Calculates spritesheet dimensions
   - Generates metadata for sprite positioning
   - Uses **Sharp** for image compositing

5. **`mirrors.ts`** - Image mirroring operations
   - Creates horizontally flipped versions of sprites
   - Uses Sharp for efficient image processing

6. **`image-size.ts`** - Image dimension measurement
   - Measures image dimensions using Sharp
   - Provides consistent sizing information

7. **`types.ts`** - Shared type definitions
   - Defines all interfaces and types used throughout the package

## Installation

Ensure you have Bun installed on your system. Then clone the repository:

```bash
git clone <repository-url>
cd freedoom-bestiary/spritesheet-generator
bun install
```

## Dependencies

- **Bun** — JavaScript/TypeScript runtime and package manager
- **Sharp** — High-performance image processing library
- **Git** — Required for accessing bare repositories

Sharp is installed automatically via `bun install`. No system-level image processing dependencies required.

## Usage

### Basic Usage

To generate spritesheets from version files:

```bash
bun run generate
```

This command will:
1. Read version files from the default directory
2. Process each sprite version
3. Generate spritesheets and metadata
4. Save output to the configured output directory

### Custom Input

To process a specific JSON file or directory:

```bash
bun run generate path/to/input.json
# or
bun run generate path/to/input/directory/
```

### Running Tests

To run the test suite:

```bash
bun test
```

## How It Works

1. **Input Processing**: The generator reads JSON files containing sprite version information, including commit metadata and file URLs.

2. **Sprite Parsing**: Sprite filenames are parsed according to Doom conventions (e.g., `POSSA1.png` represents the Possessed/Former Human sprite, frame A, angle 1).

3. **Image Retrieval**: Sprites are loaded from either local bare Git repositories or remote URLs. Local repositories are preferred for performance.

4. **Layout Calculation**: Sprites are arranged in a grid layout with frames as columns and angles as rows.

5. **Image Processing**: 
   - Images are measured for consistent sizing using Sharp
   - Mirror sprites are generated where needed using Sharp
   - All images are padded to uniform dimensions

6. **Spritesheet Generation**: Using Sharp, individual sprites are composited into a single spritesheet image.

7. **Metadata Creation**: Detailed metadata is generated, including sprite positioning information and commit details.

8. **Output**: Spritesheets are saved as WebP images with accompanying metadata in JSON format.

## Configuration

The generator can be configured through the `RuntimeConfig` interface:

- `repoRoot`: Root directory of the repository
- `versionsDir`: Directory containing version files
- `outputDir`: Output directory for generated files
- `sheetDirName`: Name of the spritesheets directory
- `indexFileName`: Name of the index file
- `cacheDirName`: Name of the cache directory
- `bareRepos`: Map of repository names to local paths
- `fetchConcurrency`: Maximum number of concurrent fetch operations

## Output Structure

Generated files are organized as follows:

```
output-directory/
├── spritesheets.json          # Index file with metadata
├── spritesheets/
│   ├── POSS/                 # Per-sprite directories
│   │   ├── abc123.webp       # Spritesheet images (named by commit SHA)
│   │   └── def456.webp
│   ├── TROO/
│   │   ├── abc123.webp
│   │   └── def456.webp
│   └── ...
└── .cache/                   # Cached sprite images
    ├── abc123def456.../
    └── ...
```

Each spritesheet is a WebP image containing all frames and angles for a specific sprite at a specific commit. The `spritesheets.json` file contains metadata mapping commit SHAs to sprite positioning information.

## Development

### Adding New Features

1. Follow the existing TSDoc documentation pattern
2. Add tests for new functionality
3. Ensure all existing tests still pass

### Code Structure

The codebase follows a modular design where each module has a single responsibility:
- Parser modules handle data transformation
- IO modules handle file operations
- Processing modules handle image manipulation (using Sharp)
- Orchestration modules coordinate the workflow

## Migration Notes

- **Migrated from Deno to Bun**: All Deno-specific APIs replaced with Bun/Node equivalents
- **ImageMagick replaced with Sharp**: Sharp provides better performance and eliminates system dependency on ImageMagick
- **Tests migrated to bun:test**: Test suite now uses Bun's built-in test runner

## License

This project is licensed under the MIT License - see the LICENSE file for details.
