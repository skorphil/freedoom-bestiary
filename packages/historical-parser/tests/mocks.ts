/**
 * Mock implementations for testing the historical-parser classes.
 * These mocks provide minimal implementations for use in TDD.
 */

import type {
  CharacterVersions,
  CharacterVersionSnapshot,
  CommitLogScannerOptions,
  CommitSnapshot,
  CommitSource,
  FileStatus,
  ScanUnit,
  SnapshotBuilderOptions,
  SpriteEntry,
  SpriteState,
  AuthorInfo,
} from "../src/types.ts";
import type { TreeEntry } from "../src/GitReader.ts";

// Test data constants
export const TEST_COMMIT_SHA = "abc123def456789012345678901234567890abcd";
export const TEST_COMMIT_DATE = "2024-01-15T10:30:00Z";
export const TEST_COMMIT_AUTHOR = "John Doe";
export const TEST_COMMIT_MESSAGE = "Add new sprite frames";

/**
 * Creates a mock SpritePattern for testing.
 * @param code - The sprite code (e.g., "POSS", "CYBR")
 * @returns A mock SpritePattern implementation
 */
export function createMockSpritePattern(code: string) {
  // Lightweight mock that matches the minimal SpritePattern surface used by tests
  const upper = code.toUpperCase();
  const regex = new RegExp(`${upper}[a-z]\\d.*\\.(png|gif)$`, "i");

  return {
    code: upper,
    // match using extraction helpers to mirror real SpritePattern behavior
    matches: (path: string) => {
      const base = path.split("/").pop() || "";
      const code = (base.match(/^([a-zA-Z0-9]{4})[a-z]\d.*\.(png|gif)$/i) || [])[1];
      if (code && code.toUpperCase() === upper) return true;
      // fallback to regex test
      return regex.test(base);
    },
    // Extract the 4-letter code from a path (or null if not present)
    extractCodeFromPath: (path: string) => {
      const base = path.split("/").pop() || "";
      const match = base.match(/^([a-zA-Z0-9]{4})[a-z]/i);
      return match ? match[1].toUpperCase() : null;
    },
    // Extract frame key (single letter) after the code
    extractFrameKey: (path: string) => {
      const base = path.split("/").pop() || "";
      const match = base.match(new RegExp(`^${upper}([a-z])`, "i"));
      return match ? match[1] : null;
    },
    // static helpers used by tests
    static: {
      basename: (p: string) => {
        if (!p) return "";
        const parts = p.split("/");
        return parts[parts.length - 1];
      },
    },
  };
}

/**
 * Creates a mock AuthorResolver for testing.
 * @returns A mock AuthorResolver implementation
 */
export function createMockAuthorResolver() {
  return {
    init: async () => {},
    resolveAuthorsBatch: async (context: any, sprites: any[]) => {
      const mapping: Record<string, AuthorInfo[]> = {};
      for (const s of sprites) {
        mapping[s.url] = [{ name: context.author, relation: "Mock" }];
      }
      return mapping;
    },
    saveCache: async () => {},
  };
}

/**
 * Creates a mock GitReader for testing.
 * @param repoPath - Path to the git repository
 * @param mockTreeEntries - Mock tree entries to return
 * @param mockSymlinkTarget - Mock symlink target to return
 * @param mockLogLines - Mock log lines to yield
 * @returns A mock GitReader implementation
 */
export function createMockGitReader(
  repoPath: string,
  mockTreeEntries: TreeEntry[] = [],
  mockSymlinkTarget = "",
  mockLogLines: string[] = [],
) {
  // Return a plain object that implements the minimal GitReader API used in tests.
  return {
    repoPath,
    streamLog: async function* (): AsyncGenerator<string> {
      for (const line of mockLogLines) {
        yield line;
      }
    },
    getTreeEntries: async (
      _sha: string,
      folderPath?: string,
    ): Promise<TreeEntry[]> => {
      if (folderPath) {
        return mockTreeEntries.filter((e) => e.path.startsWith(folderPath));
      }
      return mockTreeEntries;
    },
    resolveSymlinkTarget: async (): Promise<string> => {
      return mockSymlinkTarget;
    },
  };
}

/**
 * Creates a mock TreeEntry for testing.
 * @param path - File path
 * @param mode - File mode (default: "100644")
 * @param hash - Object hash (default: "abc123")
 * @returns A TreeEntry object
 */
export function createMockTreeEntry(
  path: string,
  mode = "100644",
  hash = "abc123",
): TreeEntry {
  return {
    mode,
    type: mode === "040000" ? "tree" : "blob",
    objectHash: hash,
    path,
    isSymlink: mode === "120000",
  };
}

/**
 * Creates a mock CommitLogScanner for testing.
 * @param reader - GitReader instance
 * @param pattern - SpritePattern instance
 * @param options - Scanner options
 * @returns A mock CommitLogScanner implementation
 */
export function createMockCommitLogScanner(
  _reader: any,
  _pattern: any,
  _options: CommitLogScannerOptions,
) {
  return {
    scan: async function* (): AsyncGenerator<ScanUnit> {
      yield {
        sha: TEST_COMMIT_SHA,
        date: TEST_COMMIT_DATE,
        author: TEST_COMMIT_AUTHOR,
        message: TEST_COMMIT_MESSAGE,
        folder: null,
        changesMap: new Map(),
      };
    },
  };
}

/**
 * Creates a mock SnapshotBuilder for testing.
 * @param reader - GitReader instance
 * @param pattern - SpritePattern instance
 * @param resolver - AuthorResolver instance
 * @param options - Builder options
 * @returns A mock SnapshotBuilder implementation
 */
export function createMockSnapshotBuilder(
  reader: any,
  pattern: any,
  resolver: any,
  options: SnapshotBuilderOptions,
) {
  return {
    build: async (
      unit: ScanUnit,
      source: CommitSource,
    ): Promise<CommitSnapshot | null> => {
      const treeEntries = await reader.getTreeEntries(
        unit.sha,
        unit.folder || undefined,
      );

      // Fallback matching logic: try to use pattern.matches when available,
      // otherwise do a permissive match using the pattern.code.
      const candidates = treeEntries
        .filter((entry: TreeEntry) => {
          if (typeof pattern.matches === "function") return pattern.matches(entry.path);
          const base = entry.path.split("/").pop() || "";
          return base.toLowerCase().includes((pattern.code || "").toLowerCase());
        })
        .map((entry: TreeEntry) => ({
          entry,
          url: `${options.githubBaseUrl}/blob/${unit.sha}/${entry.path}`,
          status: (unit.changesMap.get(entry.path) as FileStatus) || "Existing",
        }));

      if (candidates.length === 0) {
        return null;
      }

      const authorMapping = await resolver.resolveAuthorsBatch(
        { author: unit.author, message: unit.message, sha: unit.sha },
        candidates.map((c: any) => ({ url: c.url, path: c.entry.path }))
      );

      const spriteFiles = candidates.map((c: any) => ({
        code: pattern.code,
        filename: c.entry.path,
        url: c.url,
        status: c.status,
        authorNames: authorMapping[c.url] || [],
      }));

      return {
        commitDate: unit.date,
        commitAuthor: unit.author,
        commitMessage: unit.message,
        commitSha: unit.sha,
        commitUrl: `${options.githubBaseUrl}/commit/${unit.sha}`,
        commitSource: source,
        commitSprites: spriteFiles,
      } as CommitSnapshot;
    },
  };
}

/**
 * Creates a mock CommitSnapshot for testing.
 * @param sha - Commit SHA
 * @param date - Commit date
 * @param source - Commit source (freedoom or attic)
 * @param sprites - Array of sprite files
 * @returns A CommitSnapshot object
 */
export function createMockCommitSnapshot(
  sha: string,
  date: string,
  source: CommitSource,
  sprites: Array<
    { code: string; filename: string; url: string; status: FileStatus; authorNames?: AuthorInfo[] }
  >,
): CommitSnapshot {
  return {
    commitSha: sha,
    commitDate: date,
    commitAuthor: TEST_COMMIT_AUTHOR,
    commitMessage: TEST_COMMIT_MESSAGE,
    commitUrl: `https://github.com/freedoom/${source}/commit/${sha}`,
    commitSource: source,
    commitSprites: sprites.map((s) => ({
      code: s.code,
      filename: s.filename,
      url: s.url,
      status: s.status,
      authorNames: s.authorNames || [{ name: TEST_COMMIT_AUTHOR, relation: "Mock" }],
    })),
  };
}

/**
 * Creates a mock ScanUnit for testing.
 * @param overrides - Properties to override
 * @returns A ScanUnit object
 */
export function createMockScanUnit(
  overrides: Partial<ScanUnit> = {},
): ScanUnit {
  return {
    sha: TEST_COMMIT_SHA,
    date: TEST_COMMIT_DATE,
    author: TEST_COMMIT_AUTHOR,
    message: TEST_COMMIT_MESSAGE,
    folder: null,
    changesMap: new Map(),
    ...overrides,
  };
}

// Scanner and builder options for FreedomParser
export const FREEDOOM_SCANNER_OPTIONS: CommitLogScannerOptions = {
  groupByFolder: false,
  activeStatuses: ["A", "M", "T", "R"],
  skippedStatuses: ["D"],
};

export const FREEDOOM_BUILDER_OPTIONS: SnapshotBuilderOptions = {
  githubBaseUrl: "https://github.com/freedoom/freedoom",
  followSymlinks: true,
};

// Scanner and builder options for AtticParser
export const ATTIC_SCANNER_OPTIONS: CommitLogScannerOptions = {
  groupByFolder: true,
  activeStatuses: ["A", "M", "R", "C"],
  skippedStatuses: ["D"],
};

export const ATTIC_BUILDER_OPTIONS: SnapshotBuilderOptions = {
  githubBaseUrl: "https://github.com/freedoom/attic",
  followSymlinks: false,
};

/**
 * Creates a mock BaseParser for testing.
 * @param gitRepoPath - Path to the git repository
 * @param spriteCode - The sprite code (e.g., "POSS", "CYBR")
 * @param source - The commit source ("freedoom" or "attic")
 * @param _scannerOptions - Scanner options
 * @param _builderOptions - Builder options
 * @returns A mock BaseParser implementation
 */
export function createMockBaseParser(
  gitRepoPath: string,
  spriteCode: string,
  source: "freedoom" | "attic",
  _scannerOptions: CommitLogScannerOptions,
  _builderOptions: SnapshotBuilderOptions,
) {
  const reader = createMockGitReader(gitRepoPath);
  const pattern = createMockSpritePattern(spriteCode);
  const resolver = createMockAuthorResolver();

  return {
    reader,
    pattern,
    resolver,
    source,
    createScanner: () => {
      return {
        scan: async function* () {
          yield {
            sha: "abc123",
            date: "2024-01-15T10:30:00Z",
            author: "Test Author",
            message: "Test commit",
            folder: null,
            changesMap: new Map(),
          };
        },
      };
    },
    createSnapshotBuilder: () => {
      return {
        build: async () => null,
      };
    },
    parse: async (): Promise<CommitSnapshot[]> => {
      return [];
    },
    getSnapshot: async (): Promise<CommitSnapshot | null> => {
      return null;
    },
  };
}

/**
 * Creates a mock FreedomParser for testing.
 * @param gitRepoPath - Path to the git repository
 * @param spriteCode - The sprite code (e.g., "POSS", "CYBR")
 * @returns A mock FreedomParser implementation
 */
export function createMockFreedomParser(
  gitRepoPath: string,
  spriteCode: string,
) {
  const base = createMockBaseParser(
    gitRepoPath,
    spriteCode,
    "freedoom",
    FREEDOOM_SCANNER_OPTIONS,
    FREEDOOM_BUILDER_OPTIONS,
  );

  return {
    ...base,
    source: "freedoom" as const,
  };
}

/**
 * Creates a mock AtticParser for testing.
 * @param gitRepoPath - Path to the git repository
 * @param spriteCode - The sprite code (e.g., "POSS", "CYBR")
 * @returns A mock AtticParser implementation
 */
export function createMockAtticParser(gitRepoPath: string, spriteCode: string) {
  const base = createMockBaseParser(
    gitRepoPath,
    spriteCode,
    "attic",
    ATTIC_SCANNER_OPTIONS,
    ATTIC_BUILDER_OPTIONS,
  );

  return {
    ...base,
    source: "attic" as const,
  };
}

/**
 * Creates a mock VersionCombiner for testing.
 * @param code - The sprite code (e.g., "POSS", "CYBR")
 * @returns A mock VersionCombiner implementation
 */
export function createMockVersionCombiner(code: string) {
  const deriveSpriteState = (
    frameKey: string,
    newUrl: string,
    frameState: Map<string, SpriteEntry>,
  ): SpriteState => {
    const existing = frameState.get(frameKey);
    if (!existing) {
      return "new";
    }
    if (existing.url !== newUrl) {
      return "updated";
    }
    return "unchanged";
  };

  const applySnapshot = (
    snapshot: CommitSnapshot,
    frameState: Map<string, SpriteEntry>,
  ): boolean => {
    let changed = false;
    for (const sprite of snapshot.commitSprites) {
      const frameKey =
        sprite.filename.split("/").pop()?.replace(/\.[^/.]+$/, "").slice(4) ||
        "";
      const author = sprite.filename.split("/")[1] || snapshot.commitAuthor;
      const state = deriveSpriteState(frameKey, sprite.url, frameState);

      if (state === "new" || state === "updated") {
        frameState.set(frameKey, {
          name: sprite.filename.split("/").pop() || "",
          url: sprite.url,
          spriteAuthors: [{ name: author, relation: "Mock" }],
          spriteState: state,
        });
        changed = true;
      }
    }
    return changed;
  };

  const buildVersionSnapshot = (
    snapshot: CommitSnapshot,
    frameState: Map<string, SpriteEntry>,
  ) => {
    const sprites: SpriteEntry[] = [];
    frameState.forEach((entry, _frameKey) => {
      sprites.push({
        name: entry.name,
        url: entry.url,
        spriteAuthors: entry.spriteAuthors,
        spriteState: entry.spriteState,
      });
    });

    return {
      commitDate: snapshot.commitDate,
      commitMessage: snapshot.commitMessage,
      commitSource: snapshot.commitSource,
      commitUrl: snapshot.commitUrl,
      commitSha: snapshot.commitSha,
      authors: [{ name: snapshot.commitAuthor, relation: "Mock" }],
      sprites,
    };
  };

  return {
    code,
    combine: (
      freedomSnapshots: CommitSnapshot[],
      atticSnapshots: CommitSnapshot[],
    ): CharacterVersions => {
      const frameState = new Map<string, SpriteEntry>();
      const versions: CharacterVersionSnapshot[] = [];

      const allSnapshots = [...freedomSnapshots, ...atticSnapshots]
        .sort((a, b) =>
          new Date(a.commitDate).getTime() - new Date(b.commitDate).getTime()
        );

      for (const snapshot of allSnapshots) {
        const changed = applySnapshot(snapshot, frameState);
        if (changed) {
          versions.push(buildVersionSnapshot(snapshot, new Map(frameState)));
        }
      }

      return {
        code,
        spriteVersions: versions.reverse(),
      };
    },
    mergeAndSort: (
      a: CommitSnapshot[],
      b: CommitSnapshot[],
    ): CommitSnapshot[] => {
      return [...a, ...b]
        .sort((x, y) =>
          new Date(x.commitDate).getTime() - new Date(y.commitDate).getTime()
        );
    },
    applySnapshot,
    deriveSpriteState,
    buildVersionSnapshot,
  };
}
