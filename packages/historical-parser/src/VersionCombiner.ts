/**
 * Merges freedoom + attic CommitSnapshot arrays into CharacterVersions.
 *
 * **Key feature - Fix for silent-mixing bug:**
 * Instead of "attic always wins", snapshots are applied strictly chronologically.
 * A new CharacterVersionSnapshot is emitted only when at least one frame URL
 * actually changes. This ensures that a version's sprites all come from the same
 * time period, not mixed from years apart.
 *
 * The merging process:
 * 1. Merge all snapshots from both sources
 * 2. Sort chronologically (oldest first), dedup by SHA
 * 3. Walk through chronologically, maintaining frame state
 * 4. Emit a CharacterVersionSnapshot whenever a frame changes
 * 5. Return versions newest-first (reverse chronological order)
 *
 * @example
 * const combiner = new VersionCombiner("POSS");
 * const versions = combiner.combine(freedomSnapshots, atticSnapshots);
 * // versions.spriteVersions[0] is the newest version
 * // versions.spriteVersions[0].sprites contains all frames for that version
 */
export class VersionCombiner {
  /** Sprite code being combined */
  readonly code: string;

  /**
   * Creates a new VersionCombiner.
   *
   * @param code - The sprite code (e.g., "POSS")
   */
  constructor(code: string) {
    this.code = code;
  }

  /**
   * Combines freedoom and attic snapshots into CharacterVersions.
   *
   * @param freedomSnapshots - Array of snapshots from freedoom repo
   * @param atticSnapshots - Array of snapshots from attic repo
   * @returns CharacterVersions with merged version history
   */
  combine(
    freedomSnapshots: CommitSnapshot[],
    atticSnapshots: CommitSnapshot[],
  ): CharacterVersions {
    // Merge and sort snapshots chronologically
    const allSnapshots = this.mergeAndSort(freedomSnapshots, atticSnapshots);

    // Maintain frame state and track versions
    const frameState = new Map<string, SpriteEntry>();
    const versions: CharacterVersionSnapshot[] = [];

    // Process each snapshot in chronological order
    for (const snapshot of allSnapshots) {
      // Apply the snapshot and check if any frame changed
      const hasChanges = this.applySnapshot(snapshot, frameState);

      // If there were changes, create a new version snapshot
      if (hasChanges) {
        const versionSnapshot = this.buildVersionSnapshot(snapshot, frameState);
        versions.push(versionSnapshot);
      }
    }

    // Return versions in reverse chronological order (newest first)
    return {
      code: this.code,
      spriteVersions: versions.reverse(),
    };
  }

  /**
   * Merges two snapshot arrays and sorts chronologically.
   *
   * @param a - First array of snapshots
   * @param b - Second array of snapshots
   * @returns Merged and sorted array (oldest first)
   */
  private mergeAndSort(
    a: CommitSnapshot[],
    b: CommitSnapshot[],
  ): CommitSnapshot[] {
    // Merge the two arrays
    const merged = [...a, ...b];

    // Deduplicate by SHA
    const uniqueSnapshots = new Map<string, CommitSnapshot>();
    for (const snapshot of merged) {
      if (!uniqueSnapshots.has(snapshot.commitSha)) {
        uniqueSnapshots.set(snapshot.commitSha, snapshot);
      }
    }

    // Convert back to array and sort chronologically (oldest first)
    return Array.from(uniqueSnapshots.values()).sort((a, b) => {
      return new Date(a.commitDate).getTime() -
        new Date(b.commitDate).getTime();
    });
  }

  /**
   * Applies a snapshot to the frame state, tracking changes.
   *
   * @param snapshot - The commit snapshot to apply
   * @param frameState - Current frame state map
   * @returns True if any frame changed
   */
  applySnapshot(
    snapshot: CommitSnapshot,
    frameState: Map<string, SpriteEntry>,
  ): boolean {
    let hasChanges = false;

    // Filter sprites for this character code only
    const characterSprites = snapshot.commitSprites.filter(
      (sprite) => sprite.code === this.code,
    );

    // Group sprites by frame key to handle multiple overlapping sprites in one snapshot
    // A single sprite like "bossa4a6.png" matches TWO frame keys: "a4" and "a6".
    const candidates = new Map<string, SpriteEntry[]>();

    for (const sprite of characterSprites) {
      const frameKeys = this.extractFrameKeys(sprite.filename);

      for (const frameKey of frameKeys) {
        // Get current URL and determine state
        const newUrl = sprite.url;
        const spriteState = this.deriveSpriteState(
          frameKey,
          newUrl,
          frameState,
          sprite.status,
        );

        const entry: SpriteEntry = {
          name: sprite.filename,
          url: newUrl,
          spriteAuthors: sprite.authorNames ?? [snapshot.commitAuthor],
          spriteState,
          source: snapshot.commitSource,
        };

        if (!candidates.has(frameKey)) {
          candidates.set(frameKey, []);
        }
        candidates.get(frameKey)!.push(entry);
      }
    }

    // Process each frame key's candidates
    for (const [frameKey, frameCandidates] of candidates) {
      // Conflict resolution: prefer "new" or "updated" over "unchanged"
      const winner = this.selectBestCandidate(frameCandidates);

      // Check if this represents a change
      if (winner.spriteState !== "unchanged") {
        hasChanges = true;
      }

      // Update frame state
      frameState.set(frameKey, winner);
    }

    return hasChanges;
  }

  /**
   * Selects the best sprite candidate for a frame.
   * Preference: "new" > "updated" > "unchanged"
   */
  private selectBestCandidate(candidates: SpriteEntry[]): SpriteEntry {
    if (candidates.length === 1) return candidates[0];

    // Priority: "new" (0), "updated" (1), "unchanged" (2)
    const priorityMap: Record<string, number> = {
      "new": 0,
      "updated": 1,
      "unchanged": 2,
    };

    const sorted = [...candidates].sort((a, b) => {
      const pA = priorityMap[a.spriteState] ?? 99;
      const pB = priorityMap[b.spriteState] ?? 99;
      if (pA !== pB) return pA - pB;
      // Tie-breaker: stable reverse alphabetical sort on filename to prefer more specific ones if needed
      // or just stay consistent.
      return b.name.localeCompare(a.name);
    });

    return sorted[0];
  }

  /**
   * Extracts frame keys from filename.
   * Handles mirrored filenames like "bossa4a6.png" -> ["a4", "a6"]
   */
  private extractFrameKeys(filename: string): string[] {
    const base = filename.split("/").pop() || filename;
    // Match 4-letter code, then potentially multiple frame keys
    // e.g., BOSSA1 -> ["a1"], BOSSA4A6 -> ["a4", "a6"], BOSSA2A8 -> ["a2", "a8"]
    const match = base.match(/^[A-Z]{4}(([a-z][0-9]?)+)[a-z0-9_]*\.(png|gif)$/i);
    if (!match) return [base.toLowerCase()];

    const framesStr = match[1].toLowerCase();
    const frames: string[] = [];
    // Split into 2-char chunks if possible (letter + digit)
    for (let i = 0; i < framesStr.length; i += 2) {
      frames.push(framesStr.substring(i, i + 2));
    }
    return frames;
  }

  /**
   * Extracts frame key from filename.
   */
  private extractFrameKey(filename: string): string {
    return this.extractFrameKeys(filename)[0];
  }

  /**
   * Determines the state of a sprite (new/updated/unchanged).
   *
   * @param frameKey - The frame key (e.g., "a1")
   * @param newUrl - The new URL
   * @param frameState - Current frame state
   * @param gitStatus - Status of the file from Git (A, M, R, Existing, etc.)
   * @returns The sprite state
   */
  private deriveSpriteState(
    frameKey: string,
    newUrl: string,
    frameState: Map<string, SpriteEntry>,
    gitStatus: string,
  ): SpriteState {
    // If Git says the file is existing (not changed in this commit),
    // then it MUST be unchanged in our versioning logic too.
    if (gitStatus === "Existing") {
      return "unchanged";
    }

    const existingEntry = frameState.get(frameKey);

    // If no existing entry for this frame key, it's new
    if (!existingEntry) {
      return "new";
    }

    // If the URL is different, it's an update
    if (existingEntry.url !== newUrl) {
      return "updated";
    }

    // Otherwise unchanged
    return "unchanged";
  }

  /**
   * Builds a CharacterVersionSnapshot from current frame state.
   *
   * @param snapshot - The source commit snapshot
   * @param frameState - Current frame state
   * @returns Character version snapshot
   */
  buildVersionSnapshot(
    snapshot: CommitSnapshot,
    frameState: Map<string, SpriteEntry>,
  ): CharacterVersionSnapshot {
    // Convert map values to array and filter by source to avoid mixing freedoom and attic sprites
    const allSprites = Array.from(frameState.values()).filter(
      (s) => s.source === snapshot.commitSource,
    );

    // Deduplicate sprites by URL (e.g., mirrored sprites like bossa4a6.png appear twice in frameState)
    const uniqueSprites = new Map<string, SpriteEntry>();
    for (const sprite of allSprites) {
      if (!uniqueSprites.has(sprite.url)) {
        uniqueSprites.set(sprite.url, sprite);
      }
    }

    const sprites = Array.from(uniqueSprites.values());

    return {
      commitDate: snapshot.commitDate,
      commitMessage: snapshot.commitMessage,
      commitSource: snapshot.commitSource,
      commitUrl: snapshot.commitUrl,
      commitSha: snapshot.commitSha,
      authors: [snapshot.commitAuthor], // Use the actual commit author as a list
      sprites,
    };
  }
}

/** Snapshot of a commit from either repo */
type CommitSnapshot = {
  /** Commit date in ISO format */
  commitDate: string;
  /** Commit author name */
  commitAuthor: string;
  /** Commit message */
  commitMessage: string;
  /** Commit SHA hash */
  commitSha: string;
  /** URL to the commit on GitHub */
  commitUrl: string;
  /** Source repository (freedoom or attic) */
  commitSource: "freedoom" | "attic";
  /** Array of sprite files in this commit */
  commitSprites: Array<{
    /** Sprite code (e.g., "POSS") */
    code: string;
    /** File path relative to repo root */
    filename: string;
    /** Full blob URL on GitHub */
    url: string;
    /** File status */
    status: string;
    /** Resolved author: folder name for attic, commit author for freedoom */
    authorNames?: string[];
  }>;
};

/** A sprite entry in a version */
type SpriteEntry = {
  /** Frame name/key (e.g., "a1", "b2") */
  name: string;
  /** URL to the sprite image */
  url: string;
  /** Author who created/modified this sprite */
  spriteAuthors: string[];
  /** State of the sprite (new, updated, unchanged) */
  spriteState: SpriteState;
  /** Source repository (freedoom or attic) */
  source?: "freedoom" | "attic";
};

/** Sprite state tracking */
/** Valid states for a sprite in the version history */
type SpriteState = "new" | "updated" | "unchanged";

/** One version milestone in a character's history */
type CharacterVersionSnapshot = {
  /** Date of the commit in ISO format */
  commitDate: string;
  /** Commit message */
  commitMessage: string;
  /** Source repository (freedoom or attic) */
  commitSource: "freedoom" | "attic";
  /** URL to the commit on GitHub */
  commitUrl: string;
  /** Commit SHA hash */
  commitSha: string;
  /** Commit authors */
  authors: string[];
  /** Array of sprite entries for this version */
  sprites: SpriteEntry[];
};

/** Full version history for one sprite code */
type CharacterVersions = {
  /** The sprite code (e.g., "POSS", "CYBR") */
  code: string;
  /** Array of version snapshots, ordered chronologically */
  spriteVersions: CharacterVersionSnapshot[];
};
