import { CharacterItem } from "../src/components/CharacterItem.tsx";
import { bestiary } from "../src/models/SpritesheetsCollection.ts";
import type { Route } from "./+types/index";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Freedoom Bestiary" },
    { name: "description", content: "Sprites gallery from FreeDoom" },
  ];
}

export default function Index() {
  const characterCodes = bestiary.getAllCodes();

  return (
    <>
      <h1>Freedoom Bestiary</h1>
      <p>
        Sprites gallery from <a href="https://freedoom.github.io/">FreeDoom</a>
      </p>

      <div className="character-grid">
        {characterCodes.map((code) => {
          const history = bestiary.getHistory(code);
          const latest = bestiary.getLatestLiveEntry(history);
          const contributors = bestiary.getAuthors(code);

          if (!latest) return null;

          return (
            <CharacterItem
              key={code}
              spritesheet={latest}
              contributors={contributors}
              spriteCode={code}
            />
          );
        })}
      </div>
    </>
  );
}
