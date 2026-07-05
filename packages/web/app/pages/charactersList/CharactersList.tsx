import { Outlet } from "react-router"
import styles from "./CharacterSnippet.module.css"
import { CharacterItem } from "../../src/components/CharacterItem"

import type { CharacterCode, Spritesheet } from "@freedoom-bestiary/database";

type CharacterEntry = {
  code: CharacterCode;
  name: string;
  description: string;
  latest: Spritesheet;
  authors: string[];
};

type CharactersListProps = {
  characters: CharacterEntry[];
};

function CharactersList({ characters }: CharactersListProps) {
  return (
    <div className={styles.characterGrid}>
      {characters.map(({ code, name, description, latest, authors }) => (
        latest && (
          <CharacterItem
            key={code}
            spritesheet={latest}
            code={code}
            authors={authors}
          />
        )
      ))}
      <Outlet />
    </div>
  )
}

export default CharactersList
