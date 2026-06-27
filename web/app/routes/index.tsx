import styles from "../src/components/CharacterItem.module.css";
import { CharacterItem } from "../src/components/CharacterItem.tsx";
import { Header } from "../src/components/Header.tsx";
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
      <Header />

      <div className={styles.characterGrid}>
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
