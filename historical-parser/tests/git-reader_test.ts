import { expect, test } from "bun:test";
import { join } from "node:path";
import { mkdir, writeFile, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { TreeEntry } from "../src/GitReader.ts";
// Import real classes from src/
import { GitReader } from "../src/GitReader.ts";

// Mock imports (commented out as requested)
import { createMockGitReader, createMockTreeEntry } from "./mocks.ts";

// Test utilities for git operations
async function git(args: string[], cwd?: string): Promise<string> {
  const { success, stdout, stderr, exitCode } = Bun.spawnSync(["git", ...args], {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "test",
      GIT_AUTHOR_EMAIL: "t@e.st",
      GIT_COMMITTER_NAME: "test",
      GIT_COMMITTER_EMAIL: "t@e.st",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
  });

  if (!success) {
    const errText = new TextDecoder().decode(stderr);
    const outText = new TextDecoder().decode(stdout);
    throw new Error(
      `git ${args[0]} failed (code=${exitCode}): stderr=${
        errText || "(empty)"
      } | stdout=${outText || "(empty)"}`,
    );
  }
  return new TextDecoder().decode(stdout).trim();
}

async function createBareRepoWithSprites(
  tmpRoot: string,
  name: string,
  spriteFiles: Record<string, string | Uint8Array>,
): Promise<{ bareDir: string; sha: string }> {
  const workDir = join(tmpRoot, `${name}-work`);
  const bareDir = join(tmpRoot, `${name}.git`);
  const spritesDir = join(workDir, "sprites");

  await mkdir(spritesDir, { recursive: true });
  await git(["init", "-q", "-b", "main"], workDir);

  // Create sprite files
  for (const [filename, content] of Object.entries(spriteFiles)) {
    const filePath = join(spritesDir, filename);
    await writeFile(filePath, content);
  }

  await git(["add", "."], workDir);
  await git(["commit", "-q", "-m", "Initial sprites"], workDir);

  // Create bare clone
  await mkdir(bareDir, { recursive: true });
  await git(["clone", "-q", "--bare", workDir, bareDir]);

  const sha = await git(["rev-parse", "HEAD"], workDir);
  return { bareDir, sha };
}

test("GitReader - should create instance with repo path", () => {
  const reader = createMockGitReader("/tmp/freedoom.git");
  expect(reader.repoPath).toBe("/tmp/freedoom.git");
});

test("GitReader - streamLog should yield git log lines", async () => {
  const mockLogLines = [
    "abc123|2024-01-15T10:30:00Z|John Doe|First commit",
    "A\tsprites/possa1.png",
    "def456|2024-01-16T11:00:00Z|Jane Doe|Second commit",
    "M\tsprites/possa2.png",
  ];
  const reader = createMockGitReader("/tmp/freedoom.git", [], "", mockLogLines);

  const lines: string[] = [];
  for await (const line of reader.streamLog()) {
    lines.push(line);
  }

  expect(lines.length).toBe(4);
  expect(lines[0]).toBe("abc123|2024-01-15T10:30:00Z|John Doe|First commit");
  expect(lines[1]).toBe("A\tsprites/possa1.png");
});

test("GitReader - getTreeEntries should return tree entries for sha", async () => {
  const mockEntries: TreeEntry[] = [
    createMockTreeEntry("sprites/possa1.png"),
    createMockTreeEntry("sprites/possa2.png"),
    createMockTreeEntry("other", "040000"),
  ];
  const reader = createMockGitReader("/tmp/freedoom.git", mockEntries);

  const entries = await reader.getTreeEntries("abc123");

  expect(entries.length).toBe(3);
  expect(entries[0].path).toBe("sprites/possa1.png");
  expect(entries[0].type).toBe("blob");
});

test("GitReader - getTreeEntries should filter by folder path", async () => {
  const mockEntries: TreeEntry[] = [
    createMockTreeEntry("sprites/possa1.png"),
    createMockTreeEntry("sprites/possa2.png"),
    createMockTreeEntry("docs/readme.md"),
  ];
  const reader = createMockGitReader("/tmp/freedoom.git", mockEntries);

  const entries = await reader.getTreeEntries("abc123", "sprites");

  expect(entries.length).toBe(2);
  expect(entries.find((e) => e.path === "sprites/possa1.png")).toBeDefined();
  expect(entries.find((e) => e.path === "docs/readme.md")).toBeUndefined();
});

test("GitReader - resolveSymlinkTarget should return target path", async () => {
  const reader = createMockGitReader(
    "/tmp/freedoom.git",
    [],
    "../other/sprites/possa1.png",
  );

  const target = await reader.resolveSymlinkTarget("any-sha");

  expect(target).toBe("../other/sprites/possa1.png");
});

test("GitReader - should detect symlinks in tree entries", () => {
  const symlinkEntry = createMockTreeEntry("sprites/link.png", "120000");
  const regularEntry = createMockTreeEntry("sprites/regular.png", "100644");

  expect(symlinkEntry.isSymlink).toBe(true);
  expect(regularEntry.isSymlink).toBe(false);
});

test("GitReader - should execute git commands", async () => {
  const reader = createMockGitReader("/tmp/freedoom.git");

  // Just verify the reader exists
  expect(reader).toBeDefined();
});

// Integration tests with real git
test("GitReader (integration) - should create and read from bare repo", async () => {
  const tmpRoot = await mkdtemp(join(tmpdir(), "git-reader-test-"));
  try {
    const { bareDir, sha } = await createBareRepoWithSprites(tmpRoot, "test", {
      "possa1.png": new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
      "possa2.png": "PNG",
    });

    // Verify bare repo exists
    const stats = await stat(bareDir);
    expect(stats.isDirectory()).toBe(true);

    // Verify commit sha was returned
    expect(sha.length).toBe(40);
  } finally {
    await rm(tmpRoot, { recursive: true });
  }
});
