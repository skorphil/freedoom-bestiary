export interface CharacterItemProps {
  spriteCode: string;
  webpPath: string;
  authors: string[];
  commitDate: string;
  commitSha: string;
  commitUrl: string;
  commitMessage: string;
}

export function CharacterItem({
  spriteCode,
  webpPath,
  authors,
  commitDate,
  commitSha,
  commitUrl,
  commitMessage,
}: CharacterItemProps) {
  const dateLabel = new Date(commitDate).toISOString().slice(0, 10);
  return (
    <card className="character-item">
      <p>{spriteCode}</p>
      <div className="character-preview">
        <img src={webpPath} alt={`${spriteCode} idling animation`} />
      </div>
      <p className="character-meta">
        Latest:{" "}
        <a href={commitUrl} title={commitMessage}>
          {dateLabel} · {commitSha.slice(0, 7)}
        </a>
      </p>
      <p>Contributors: {authors.join(", ")}</p>
    </card>
  );
}
