import type { TreeEntry } from "./GitReader.ts";
import type { CommitLogScannerOptions } from "./CommitLogScanner.ts";
import type { SnapshotBuilderOptions } from "./SnapshotBuilder.ts";
import { CreditsFileProvider } from "./CreditsFileProvider.ts";
import { GitReader } from "./GitReader.ts";
import { AuthorResolver, SpritePattern } from "./types.ts";
import { CommitLogScanner } from "./CommitLogScanner.ts";
import { SnapshotBuilder } from "./SnapshotBuilder.ts";
import type { CommitSnapshot, ScanUnit } from "./types.ts";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Abstract template-method base for sprite parsers.
 *
 * Subclasses provide concrete implementations for:
 * - Scanner configuration (groupByFolder, activeStatuses)
 * - Builder configuration (followSymlinks, githubBaseUrl)
 * - Source identification (freedoom or attic)
 *
 * The template method `parse()` orchestrates the full parsing pipeline:
 * 1. Create scanner with appropriate options
2. Scan all commits
3. Build snapshot for each scan unit
4. Return array of snapshots

@example
class MyParser extends BaseParser {
  protected createScanner(): CommitLogScanner {
    return new CommitLogScanner(this.reader, this.pattern, {
      groupByFolder: false,
      activeStatuses: ["A", "M"],
      skippedStatuses: ["D"]
    });
  }
  // ... other abstract methods
}
*/
export abstract class BaseParser {
  /** Git reader for repository operations */
  protected reader: GitReader;
  /** Sprite pattern for matching files */
  protected pattern: SpritePattern;
  /** Author resolver for attribution */
  protected resolver: AuthorResolver;

  /**
   * Creates a new BaseParser.
   *
   * @param gitRepoPath - Absolute path to bare git repository
   * @param spriteCode - Sprite code to parse (e.g., "POSS")
   */
  constructor(gitRepoPath: string, spriteCode: string) {
    this.reader = new GitReader(gitRepoPath);
    this.pattern = new SpritePattern(spriteCode);
    this.resolver = new AuthorResolver();
    this.initCredits(gitRepoPath);
  }

  private initCredits(gitRepoPath: string) {
    // Credits file is usually in the sibling directory of the .git repo
    // or we can try to find it relative to the workspace root.
    // Bare clones don't have working trees, so we should look in the actual source repo if possible.
    const workspaceRoot = process.cwd();
    const creditsPath = join(workspaceRoot, "CREDITS");
    if (existsSync(creditsPath)) {
      const content = readFileSync(creditsPath, "utf-8");
      this.resolver.setCreditsProvider(new CreditsFileProvider(content));
    }
  }

  /**
   * Parses the full commit history for this sprite.
   *
   * @returns Array of commit snapshots, sorted chronologically
   */
  async parse(): Promise<CommitSnapshot[]> {
    // Create scanner and builder using factory methods
    const scanner = this.createScanner();
    const builder = this.createSnapshotBuilder();

    // Scan all commits
    const snapshots: CommitSnapshot[] = [];
    for await (const unit of scanner.scan()) {
      const snapshot = await builder.build(unit, this.source);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    return snapshots;
  }

  /**
   * Gets a snapshot for a specific commit (useful for debugging).
   *
   * @param sha - Commit SHA
   * @param folder - Optional folder (for attic parser)
   * @returns The commit snapshot, or null if no sprites
   */
  async getSnapshot(
    sha: string,
    folder?: string,
  ): Promise<CommitSnapshot | null> {
    // Create scanner and builder using factory methods
    const scanner = this.createScanner();
    const builder = this.createSnapshotBuilder();

    // Scan all commits and find the one matching the SHA
    for await (const unit of scanner.scan()) {
      if (unit.sha === sha) {
        // If folder is specified, check if it matches (for attic parser)
        if (folder === undefined || unit.folder === folder) {
          // Build and return the snapshot
          return await builder.build(unit, this.source);
        }
      }
    }

    // If no matching unit was found, return null
    return null;
  }

  /**
   * Factory method: Creates a CommitLogScanner with appropriate options.
   * Must be implemented by subclasses.
   *
   * @returns Configured CommitLogScanner instance
   */
  protected abstract createScanner(): CommitLogScanner;

  /**
   * Factory method: Creates a SnapshotBuilder with appropriate options.
   * Must be implemented by subclasses.
   *
   * @returns Configured SnapshotBuilder instance
   */
  protected abstract createSnapshotBuilder(): SnapshotBuilder;

  /**
   * Identifies the source repository.
   * Must be implemented by subclasses.
   */
  protected abstract get source(): "freedoom" | "attic";
}

/**
 * Parser for the freedoom/freedoom repository.
 *
 * Configuration:
 * - groupByFolder: false (1 ScanUnit per commit)
 * - activeStatuses: ["A", "M", "T", "R"]
 * - followSymlinks: true
 * - githubBaseUrl: https://github.com/freedoom/freedoom
 * - Author resolution: Always uses commitAuthor (Shape 1)
 *
 * @example
 * const parser = new FreedomParser("/path/to/freedoom.git", "POSS");
 * const snapshots = await parser.parse();
 */
export class FreedomParser extends BaseParser {
  /**
   * Creates a FreedomParser.
   *
   * @param gitRepoPath - Path to freedoom.git bare repository
   * @param spriteCode - Sprite code to parse
   */
  constructor(gitRepoPath: string, spriteCode: string) {
    super(gitRepoPath, spriteCode);
  }

  protected createScanner(): CommitLogScanner {
    return new CommitLogScanner(this.reader, this.pattern, {
      groupByFolder: false,
      activeStatuses: ["A", "M", "T", "R"],
      skippedStatuses: ["D"],
    });
  }

  protected createSnapshotBuilder(): SnapshotBuilder {
    return new SnapshotBuilder(this.reader, this.pattern, this.resolver, {
      githubBaseUrl: "https://github.com/freedoom/freedoom",
      followSymlinks: false,
    });
  }

  protected get source(): "freedoom" {
    return "freedoom";
  }
}

/**
 * Parser for the freedoom/attic repository.
 *
 * Configuration:
 * - groupByFolder: true (N ScanUnits per commit, grouped by author folder)
 * - activeStatuses: ["A", "M", "R", "C"]
 * - followSymlinks: false
 * - githubBaseUrl: https://github.com/freedoom/attic
 * - Author resolution: Extracts from folder path (Shapes 2, 3, 4)
 *
 * @example
 * const parser = new AtticParser("/path/to/attic.git", "POSS");
 * const snapshots = await parser.parse();
 */
export class AtticParser extends BaseParser {
  /**
   * Creates an AtticParser.
   *
   * @param gitRepoPath - Path to attic.git bare repository
   * @param spriteCode - Sprite code to parse
   */
  constructor(gitRepoPath: string, spriteCode: string) {
    super(gitRepoPath, spriteCode);
  }

  protected createScanner(): CommitLogScanner {
    return new CommitLogScanner(this.reader, this.pattern, {
      groupByFolder: true,
      activeStatuses: ["A", "M", "R", "C"],
      skippedStatuses: ["D"],
    });
  }

  protected createSnapshotBuilder(): SnapshotBuilder {
    return new SnapshotBuilder(this.reader, this.pattern, this.resolver, {
      githubBaseUrl: "https://github.com/freedoom/attic",
      followSymlinks: false,
    });
  }

  protected get source(): "attic" {
    return "attic";
  }
}
