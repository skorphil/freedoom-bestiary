import styles from "./CharacterItem.module.css";
import { Link } from "react-router";
import type { CharacterCode, Spritesheet } from "@freedoom-bestiary/database";
import { Animator } from "./animator/Animator.tsx";
import { CharacterRepository } from "@freedoom-bestiary/database";

type CharacterItemProps = {
  spritesheet: Spritesheet;
  code: CharacterCode;
  authors: string[];
};

export function CharacterItem({
  spritesheet,
  code,
  authors,
}: CharacterItemProps) {
  const {
    commitDate,
    commitSha,
    commitUrl,
    commitMessage,
  } = spritesheet;
  const dateLabel = new Date(commitDate).toISOString().slice(0, 10);
  const character = CharacterRepository.getCharacter(code);
  
  return (
    <div className={styles.characterItem}>
      <div className={styles.characterDetails}>
        <h2 className={styles.characterName}>
          <Link to={`/character/${code}`} className={styles.characterLink}>
            {character.freedoomName || code}
          </Link>
        </h2>
        
        <div className={styles.metaGroup}>
          <div className={styles.metaLabel}>Latest commit</div>
          <div className={styles.metaValue}>
            <a href={commitUrl} title={commitMessage}>
              {dateLabel} · {commitSha.slice(0, 7)}
            </a>
          </div>
        </div>

        <div className={styles.metaGroup}>
          <div className={styles.metaLabel}>Contributors</div>
          <div className={styles.metaValue}>
            {authors.map((name, i) => (
              <span key={name}>
                <Link to={`/authors/${name}`}>{name}</Link>
                {i < authors.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Animator code={code} version={spritesheet} meta={character} />
    </div>
  );
}
