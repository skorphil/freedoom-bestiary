## About
This project's goal is to create a web page, featuring all the enemies of [FreeDoom](https://freedoom.github.io/).


## Roadmap
1. ✅ Create a script to generate page out of existing git commits
2. ⏳ Create automation which will automatically add enemies future sprites to the bestiary page
3. ⏳ Integrate with FreeDoom official page (?)


## Tech
- **Bun** — Fast JavaScript runtime and package manager
- **React Router v7** — Framework with SSG (Static Site Generation)
- **Sharp** — High-performance image processing (replaces ImageMagick)

## Getting Started

### Prerequisites
1. [Install Bun](https://bun.sh/docs/installation)
2. Install dependencies: `bun install`

### Running

```bash
# Install dependencies for all packages
bun install

# Build the web site
bun run --cwd web build

# Run tests across all packages
bun test
```

## Contribute

### `/web`
Static web page, featuring `.webp` sprite animations. Bun + React Router v7 + React

### `/historical-parser`
Scripts to get all sprites from `/attic` and `/freedoom` git, and then generate `.webp` animations and `animations.json` metadata.

### `/spritesheet-generator`
Generates optimized spritesheets from parsed sprite data using Sharp for image processing.
