import styles from "./CharacterItem.module.css";
import { Link } from "react-router";
import type { CharacterCode, Spritesheet, Character } from "@freedoom-bestiary/database/schema";
import { Animator } from "./animator/Animator.tsx";

type CharacterItemProps = {
  spritesheet: Spritesheet;
  code: CharacterCode;
  authors: string[];
  character: Character;
};

export function CharacterItem({
  spritesheet,
  code,
  authors,
  character,
}: CharacterItemProps) {
  const {
    commitDate,
    commitSha,
    commitUrl,
    commitMessage,
  } = spritesheet;
  const dateLabel = commitDate ? new Date(commitDate).toISOString().slice(0, 10) : "Unknown";
  
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
              {dateLabel} · {commitSha?.slice(0, 7) || "unknown"}
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
      <Animator uuid={spritesheet.spritesheetId} />
    </div>
  );
}
