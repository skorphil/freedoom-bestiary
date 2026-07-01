/**
 * Merges freedoom + attic CommitSnapshot arrays into CharacterVersions.
 */
import type { 
  CommitSnapshot, 
  CharacterVersions, 
  CharacterVersionSnapshot, 
  SpriteEntry, 
  SpriteState 
} from "./types.ts";

export class VersionCombiner {
  readonly code: string;

  constructor(code: string) {
    this.code = code;
  }

  combine(
    freedomSnapshots: CommitSnapshot[],
    atticSnapshots: CommitSnapshot[],
  ): CharacterVersions {
    const allSnapshots = this.mergeAndSort(freedomSnapshots, atticSnapshots);
    const frameState = new Map<string, SpriteEntry>();
    const versions: CharacterVersionSnapshot[] = [];

    for (const snapshot of allSnapshots) {
      const hasChanges = this.applySnapshot(snapshot, frameState);
      if (hasChanges) {
        const versionSnapshot = this.buildVersionSnapshot(snapshot, frameState);
        versions.push(versionSnapshot);
      }
    }

    return {
      code: this.code,
      spriteVersions: versions.reverse(),
    };
  }

  private mergeAndSort(
    a: CommitSnapshot[],
    b: CommitSnapshot[],
  ): CommitSnapshot[] {
    const merged = [...a, ...b];
    const uniqueSnapshots = new Map<string, CommitSnapshot>();
    for (const snapshot of merged) {
      const key = `${snapshot.commitSha}_${snapshot.commitIndex}`;
      if (!uniqueSnapshots.has(key)) {
        uniqueSnapshots.set(key, snapshot);
      }
    }
    return Array.from(uniqueSnapshots.values()).sort((a, b) => {
      const dateDiff = new Date(a.commitDate).getTime() - new Date(b.commitDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.commitIndex - b.commitIndex;
    });
  }

  applySnapshot(
    snapshot: CommitSnapshot,
    frameState: Map<string, SpriteEntry>,
  ): boolean {
    let hasChanges = false;
    const characterSprites = snapshot.commitSprites.filter(
      (sprite) => sprite.code === this.code,
    );

    const candidates = new Map<string, SpriteEntry[]>();

    for (const sprite of characterSprites) {
      const frameKeys = this.extractFrameKeys(sprite.filename);
      for (const frameKey of frameKeys) {
        const spriteState = this.deriveSpriteState(
          frameKey,
          sprite.url,
          frameState,
          sprite.status,
        );

        const entry: SpriteEntry = {
          name: sprite.filename,
          url: sprite.url,
          spriteAuthors: sprite.authorNames,
          spriteState,
          commitIndex: snapshot.commitIndex,
          lastChangedDate: snapshot.commitDate,
          source: snapshot.commitSource,
        };

        if (!candidates.has(frameKey)) {
          candidates.set(frameKey, []);
        }
        candidates.get(frameKey)!.push(entry);
      }
    }

    for (const [frameKey, frameCandidates] of candidates) {
      const winner = this.selectBestCandidate(frameCandidates);
      if (winner.spriteState !== "unchanged") {
        hasChanges = true;
      }
      frameState.set(frameKey, winner);
    }

    if (this.resolveConflicts(frameState)) {
      hasChanges = true;
    }

    return hasChanges;
  }

  /**
   * Resolves conflicts between angle 0 and angles 1-8 for each frame letter.
   * If both exist, the newer set wins. If same age, 1-8 wins.
   * @returns true if any sprites were removed
   */
  private resolveConflicts(frameState: Map<string, SpriteEntry>): boolean {
    const frameGroups = new Map<string, string[]>();
    for (const frameKey of frameState.keys()) {
      const letter = frameKey.charAt(0);
      if (!frameGroups.has(letter)) {
        frameGroups.set(letter, []);
      }
      frameGroups.get(letter)!.push(frameKey);
    }

    let removedAny = false;

    for (const [letter, keys] of frameGroups) {
      const angle0Keys = keys.filter(k => k.endsWith("0"));
      const angle1to8Keys = keys.filter(k => {
        const angle = k.charAt(1);
        return angle >= "1" && angle <= "8";
      });

      if (angle0Keys.length > 0 && angle1to8Keys.length > 0) {
        // Conflict detected for this frame letter.
        // Compare max(commitIndex) within the latest date.
        
        const allEntries = keys.map(k => frameState.get(k)!);
        const maxDate = Math.max(...allEntries.map(e => new Date(e.lastChangedDate).getTime()));
        
        const latestEntries = allEntries.filter(e => new Date(e.lastChangedDate).getTime() === maxDate);
        const maxIndex = Math.max(...latestEntries.map(e => e.commitIndex));

        const winningEntries = latestEntries.filter(e => e.commitIndex === maxIndex);
        const winWith0 = winningEntries.some(e => e.name.match(/[a-z]0\.(png|gif)$/i));

        if (winWith0) {
          // Latest update was angle 0, wipe out 1-8
          for (const k of angle1to8Keys) {
            frameState.delete(k);
            removedAny = true;
          }
        } else {
          // Latest update was 1-8, wipe out 0
          for (const k of angle0Keys) {
            frameState.delete(k);
            removedAny = true;
          }
        }
      }
    }

    return removedAny;
  }

  private selectBestCandidate(candidates: SpriteEntry[]): SpriteEntry {
    if (candidates.length === 1) return candidates[0];
    const priorityMap: Record<string, number> = {
      "new": 0, "updated": 1, "unchanged": 2,
    };
    return [...candidates].sort((a, b) => {
      const pA = priorityMap[a.spriteState] ?? 99;
      const pB = priorityMap[b.spriteState] ?? 99;
      if (pA !== pB) return pA - pB;
      return b.name.localeCompare(a.name);
    })[0];
  }

  private extractFrameKeys(filename: string): string[] {
    const base = filename.split("/").pop() || filename;
    const match = base.match(/^[A-Z]{4}(([a-z][0-9]?)+)[a-z0-9_]*\.(png|gif)$/i);
    if (!match) return [base.toLowerCase()];
    const framesStr = match[1].toLowerCase();
    const frames: string[] = [];
    for (let i = 0; i < framesStr.length; i += 2) {
      frames.push(framesStr.substring(i, i + 2));
    }
    return frames;
  }

  private deriveSpriteState(
    frameKey: string,
    newUrl: string,
    frameState: Map<string, SpriteEntry>,
    gitStatus: string,
  ): SpriteState {
    if (gitStatus === "Existing") return "unchanged";
    const existingEntry = frameState.get(frameKey);
    if (!existingEntry) return "new";
    if (existingEntry.url !== newUrl) return "updated";
    return "unchanged";
  }

  buildVersionSnapshot(
    snapshot: CommitSnapshot,
    frameState: Map<string, SpriteEntry>,
  ): CharacterVersionSnapshot {
    const allSprites = Array.from(frameState.values()).filter(
      (s) => s.source === snapshot.commitSource,
    );

    const uniqueSprites = new Map<string, SpriteEntry>();
    for (const sprite of allSprites) {
      if (!uniqueSprites.has(sprite.url)) {
        uniqueSprites.set(sprite.url, sprite);
      }
    }

    const sprites = Array.from(uniqueSprites.values());
    
    // Aggregated authors for the snapshot (unique list)
    const authorsMap = new Map<string, string>();
    for (const s of sprites) {
      for (const a of s.spriteAuthors) {
        authorsMap.set(a.name, a.relation);
      }
    }
    const authors = Array.from(authorsMap.entries()).map(([name, relation]) => ({ name, relation }));

    return {
      commitDate: snapshot.commitDate,
      commitMessage: snapshot.commitMessage,
      commitSource: snapshot.commitSource,
      commitUrl: snapshot.commitUrl,
      commitSha: snapshot.commitSha,
      commitIndex: snapshot.commitIndex,
      folder: snapshot.folder ?? undefined,
      authors: authors.length > 0 ? authors : [{ name: snapshot.commitAuthor, relation: "Commit author" }],
      sprites,
    };
  }
}
