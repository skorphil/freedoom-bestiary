import styles from "./CharacterItem.module.css";
import { SpriteCode, SpritesheetVersion } from "../models/schema.ts";
import { Animator } from "./animator/Animator.tsx";
import spriteMeta from "@sprites_meta/sprites_meta.json";
import { Link } from "react-router";

type CharacterItemProps = {
  spritesheet: SpritesheetVersion;
  spriteCode: SpriteCode;
  contributors: string[];
};

export function CharacterItem({
  spritesheet,
  spriteCode,
  contributors,
}: CharacterItemProps) {
  const {
    date,
    sha,
    commitUrl,
    commitMessage,
  } = spritesheet;
  const dateLabel = new Date(date).toISOString().slice(0, 10);
  const meta = (spriteMeta as any).find((m: any) => m.sprite === spriteCode);
  return (
    <div className={styles.characterItem}>
     

      <div className={styles.characterDetails}>
        <h2 className={styles.characterName}>
          <Link to={`/character/${spriteCode}`} className={styles.characterLink}>
            {meta?.freedoomName || spriteCode}
          </Link>
        </h2>
        
        <div className={styles.metaGroup}>
          <div className={styles.metaLabel}>Latest commit</div>
          <div className={styles.metaValue}>
            <a href={commitUrl} title={commitMessage}>
              {dateLabel} · {sha.slice(0, 7)}
            </a>
          </div>
        </div>

        <div className={styles.metaGroup}>
          <div className={styles.metaLabel}>Contributors</div>
          <div className={styles.metaValue}>
            {contributors.map((name, i) => (
              <span key={name}>
                <Link to={`/authors/${name}`}>{name}</Link>
                {i < contributors.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
       {meta && <Animator code={spriteCode} version={spritesheet} meta={meta} />}
    </div>
  );
}
