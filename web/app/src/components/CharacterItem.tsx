import { SpriteCode, SpritesheetVersion } from "../models/schema.ts";
import { Animator } from "./animator/Animator.tsx";
import spriteMeta from "@sprites_meta/sprites_meta.json";

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
    <div className="character-item">
      {meta && <Animator code={spriteCode} version={spritesheet} meta={meta} />}

      <p>{spriteCode}</p>
      <div className="character-preview">
        {/* <img src={webpPath} alt={`${spriteCode} idling animation`} /> */}
      </div>
      <p className="character-meta">
        Latest:{" "}
        <a href={commitUrl} title={commitMessage}>
          {dateLabel} · {sha.slice(0, 7)}
        </a>
      </p>
      <p>contributors: {contributors.join(", ")}</p>
    </div>
  );
}
