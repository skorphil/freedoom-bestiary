import { Outlet } from "react-router"
import styles from "./CharacterSnippet.module.css"
import { CharacterItem } from "../../src/components/CharacterItem"

import type { CharacterCode, Spritesheet, Character } from "@freedoom-bestiary/database";

type CharacterEntry = {
  code: CharacterCode;
  name: string;
  description: string;
  latest: Spritesheet;
  authors: string[];
  character: Character;
};

type CharactersListProps = {
  characters: CharacterEntry[];
};

function CharactersList({ characters }: CharactersListProps) {
  return (
    <div className={styles.characterGrid}>
      {characters.map(({ code, name, description, latest, authors, character }) => (
        latest && (
          <CharacterItem
            key={code}
            spritesheet={latest}
            code={code}
            authors={authors}
            character={character}
          />
        )
      ))}
      <Outlet />
    </div>
  )
}

export default CharactersList
