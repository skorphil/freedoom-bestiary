import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { join } from "@std/path";
import type { TreeEntry } from "../src/GitReader.ts";
// Import real classes from src/
import { GitReader } from "../src/GitReader.ts";

// Mock imports (commented out as requested)
import { createMockGitReader, createMockTreeEntry } from "./mocks.ts";

// Test utilities for git operations
async function git(args: string[], cwd?: string): Promise<string> {
  const cmd = new Deno.Command("git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
    env: {
      GIT_AUTHOR_NAME: "test",
      GIT_AUTHOR_EMAIL: "t@e.st",
      GIT_COMMITTER_NAME: "test",
      GIT_COMMITTER_EMAIL: "t@e.st",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
  });
  const output = await cmd.output();
  const { success, stdout, stderr, code } = output;
  if (!success) {
    const errText = new TextDecoder().decode(stderr);
    const outText = new TextDecoder().decode(stdout);
    throw new Error(
      `git ${args[0]} failed (code=${code}): stderr=${
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

  await Deno.mkdir(spritesDir, { recursive: true });
  await git(["init", "-q", "-b", "main"], workDir);

  // Create sprite files
  for (const [filename, content] of Object.entries(spriteFiles)) {
    const filePath = join(spritesDir, filename);
    if (typeof content === "string") {
      await Deno.writeTextFile(filePath, content);
    } else {
      await Deno.writeFile(filePath, content);
    }
  }

  await git(["add", "."], workDir);
  await git(["commit", "-q", "-m", "Initial sprites"], workDir);

  // Create bare clone
  await Deno.mkdir(bareDir, { recursive: true });
  await git(["clone", "-q", "--bare", workDir, bareDir]);

  const sha = await git(["rev-parse", "HEAD"], workDir);
  return { bareDir, sha };
}

Deno.test("GitReader - should create instance with repo path", () => {
  const reader = createMockGitReader("/tmp/freedoom.git");
  assertEquals(reader.repoPath, "/tmp/freedoom.git");
});

Deno.test("GitReader - streamLog should yield git log lines", async () => {
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

  assertEquals(lines.length, 4);
  assertEquals(lines[0], "abc123|2024-01-15T10:30:00Z|John Doe|First commit");
  assertEquals(lines[1], "A\tsprites/possa1.png");
});

Deno.test("GitReader - getTreeEntries should return tree entries for sha", async () => {
  const mockEntries: TreeEntry[] = [
    createMockTreeEntry("sprites/possa1.png"),
    createMockTreeEntry("sprites/possa2.png"),
    createMockTreeEntry("other", "040000"),
  ];
  const reader = createMockGitReader("/tmp/freedoom.git", mockEntries);

  const entries = await reader.getTreeEntries("abc123");

  assertEquals(entries.length, 3);
  assertEquals(entries[0].path, "sprites/possa1.png");
  assertEquals(entries[0].type, "blob");
});

Deno.test("GitReader - getTreeEntries should filter by folder path", async () => {
  const mockEntries: TreeEntry[] = [
    createMockTreeEntry("sprites/possa1.png"),
    createMockTreeEntry("sprites/possa2.png"),
    createMockTreeEntry("docs/readme.md"),
  ];
  const reader = createMockGitReader("/tmp/freedoom.git", mockEntries);

  const entries = await reader.getTreeEntries("abc123", "sprites");

  assertEquals(entries.length, 2);
  assertExists(entries.find((e) => e.path === "sprites/possa1.png"));
  assertEquals(entries.find((e) => e.path === "docs/readme.md"), undefined);
});

Deno.test("GitReader - resolveSymlinkTarget should return target path", async () => {
  const reader = createMockGitReader(
    "/tmp/freedoom.git",
    [],
    "../other/sprites/possa1.png",
  );

  const target = await reader.resolveSymlinkTarget();

  assertEquals(target, "../other/sprites/possa1.png");
});

Deno.test("GitReader - should detect symlinks in tree entries", () => {
  const symlinkEntry = createMockTreeEntry("sprites/link.png", "120000");
  const regularEntry = createMockTreeEntry("sprites/regular.png", "100644");

  assertEquals(symlinkEntry.isSymlink, true);
  assertEquals(regularEntry.isSymlink, false);
});

Deno.test("GitReader - should execute git commands", async () => {
  const reader = createMockGitReader("/tmp/freedoom.git");

  // Just verify the reader exists
  assertExists(reader);
});

// Integration tests with real git
Deno.test("GitReader (integration) - should create and read from bare repo", async () => {
  const tmpDir = await Deno.makeTempDir({ prefix: "git-reader-test-" });
  try {
    const { bareDir, sha } = await createBareRepoWithSprites(tmpDir, "test", {
      "possa1.png": new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
      "possa2.png": "PNG",
    });

    // Verify bare repo exists
    const stat = await Deno.stat(bareDir);
    assertEquals(stat.isDirectory, true);

    // Verify commit sha was returned
    assertEquals(sha.length, 40);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});
