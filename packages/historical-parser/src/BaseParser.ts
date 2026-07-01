import { CommitLogScanner } from "./CommitLogScanner";
import { GitReader } from "./GitReader";
import { SnapshotBuilder } from "./SnapshotBuilder";
import { SpritePattern } from "./SpritePattern";
import type { CommitSnapshot, AuthorResolver } from "./types.ts";

/**
 * Base class for git history parsers.
 */
export abstract class BaseParser {
  protected reader: GitReader;
  protected scanner: CommitLogScanner;
  protected builder: SnapshotBuilder;

  constructor(
    repoPath: string,
    code: string,
    resolver: AuthorResolver,
    config: {
      githubBaseUrl: string;
      followSymlinks: boolean;
      groupByFolder: boolean;
      extraPaths?: string[];
      activeStatuses: string[];
      skippedStatuses: string[];
    },
  ) {
    this.reader = new GitReader(repoPath);
    const pattern = new SpritePattern(code);
    this.scanner = new CommitLogScanner(this.reader, pattern, {
      groupByFolder: config.groupByFolder,
      activeStatuses: config.activeStatuses,
      skippedStatuses: config.skippedStatuses,
      spriteCode: code,
      extraPaths: config.extraPaths,
    });
    this.builder = new SnapshotBuilder(this.reader, pattern, resolver, {
      githubBaseUrl: config.githubBaseUrl,
      followSymlinks: config.followSymlinks,
    });
  }

  /**
   * Parses the git history and returns commit snapshots.
   */
  async parse(): Promise<CommitSnapshot[]> {
    const snapshots: CommitSnapshot[] = [];
    const shaIndexMap = new Map<string, number>();

    for await (const unit of this.scanner.scan()) {
      const index = shaIndexMap.get(unit.sha) || 0;
      shaIndexMap.set(unit.sha, index + 1);

      const snapshot = await this.builder.build(unit, this.getSource());
      if (snapshot) {
        snapshot.commitIndex = index;
        snapshots.push(snapshot);
      }
    }
    return snapshots;
  }

  protected abstract getSource(): "freedoom" | "attic";
}

/**
 * Parser for the main freedoom repository.
 */
export class FreedomParser extends BaseParser {
  constructor(repoPath: string, code: string, resolver: AuthorResolver) {
    super(repoPath, code, resolver, {
      githubBaseUrl: "https://github.com/freedoom/freedoom",
      followSymlinks: true,
      groupByFolder: true,
      activeStatuses: ["A", "M", "T", "R"],
      skippedStatuses: ["D"],
    });
  }

  protected getSource(): "freedoom" | "attic" {
    return "freedoom";
  }
}

/**
 * Parser for the freedoom attic repository.
 */
export class AtticParser extends BaseParser {
  constructor(repoPath: string, code: string, resolver: AuthorResolver) {
    super(repoPath, code, resolver, {
      githubBaseUrl: "https://github.com/freedoom/attic",
      followSymlinks: false,
      groupByFolder: true,
      extraPaths: ["sprites"],
      activeStatuses: ["A", "M", "R", "C"],
      skippedStatuses: ["D"],
    });
  }

  protected getSource(): "freedoom" | "attic" {
    return "attic";
  }
}
