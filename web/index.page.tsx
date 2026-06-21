import animations from "./animations/animations.json" with { type: "json" };
import { CharacterItem } from "./components/CharacterItem.tsx";

export const layout = "main.tsx";
export const title = "Freedoom Bestiary";

interface SpriteEntry {
  date: string;
  author: string;
  message: string;
  gitUrl: string;
  sha: string;
  animations: {
    idling?: { angles: { angle: number; webp: string }[] };
    [key: string]: unknown;
  };
}

function isAtticEntry(entry: SpriteEntry): boolean {
  return entry.gitUrl.includes("/attic/");
}

function latestEntry(entries: SpriteEntry[]): SpriteEntry | undefined {
  const live = entries.filter((e) => !isAtticEntry(e));
  return [...live].sort((a, b) => b.date.localeCompare(a.date))[0];
}

function firstIdleWebp(entries: SpriteEntry[]): string | null {
  const latest = latestEntry(entries);
  const path = latest?.animations?.idling?.angles?.[0]?.webp;
  return path
    ? path.replace(/^out\/animations\//, "/animations/animations/")
    : null;
}

function uniqueAuthors(entries: SpriteEntry[]): string[] {
  return [...new Set(entries.map((e) => e.author))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export default (data: Lume.Data) => (
  <>
    <h1>{data.title}</h1>
    <p>
      Sprites gallery from <a href="https://freedoom.github.io/">FreeDoom</a>
    </p>
    <div className="character-grid">
      {Object.entries(animations as Record<string, SpriteEntry[]>).map(
        ([spriteCode, entries]) => {
          const latest = latestEntry(entries);
          const webpPath = firstIdleWebp(entries);
          if (!latest || !webpPath) return null;
          return (
            <CharacterItem
              spriteCode={spriteCode}
              webpPath={webpPath}
              authors={uniqueAuthors(entries)}
              commitDate={latest.date}
              commitSha={latest.sha}
              commitUrl={latest.gitUrl}
              commitMessage={latest.message}
            />
          );
        },
      )}
    </div>
  </>
);
