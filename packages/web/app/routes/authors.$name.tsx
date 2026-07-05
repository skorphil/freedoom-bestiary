import { Link } from "react-router";
import styles from "../src/components/CharacterItem.module.css";
import { Header } from "../src/components/Header.tsx";
import { Animator } from "../src/components/animator/Animator.tsx";
import { createSpritesheetsCollection } from "../src/models/SpritesheetsCollection.ts";
import { SpritesheetRepository, CharacterRepository } from "@freedoom-bestiary/database";
import type { Route } from "./+types/authors.$name";
import type { CharacterCode, Spritesheet } from "@freedoom-bestiary/database";

export function meta({ params }: Route.MetaArgs) {
  const name = decodeURIComponent(params.name || "");
  return [
    { title: `${name} - Contributions - Freedoom Bestiary` },
    { name: "description", content: `Sprite versions contributed by ${name}` },
  ];
}

// This runs at BUILD TIME during SSG
export async function loader({ params }: Route.LoaderArgs) {
  const name = decodeURIComponent(params.name || "");
  
  const allSheets = await SpritesheetRepository.getAllSpritesheets();
  const collection = createSpritesheetsCollection(allSheets);
  const contributions = collection.getAuthorContributions(name);

  // Pre-process contributions to include character data
  const processedContributions = contributions.map(({ code, sheet }) => ({
    code,
    sheet,
    character: CharacterRepository.getCharacter(code),
    authorsWithRelations: collection.getAuthorsWithRelations(sheet)
  }));

  return {
    name,
    contributions: processedContributions,
  };
}

export default function AuthorPage({ loaderData }: Route.ComponentProps) {
  const { name, contributions } = loaderData;

  return (
    <>
      <Header />
      
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{fontSize: "40px", marginBottom: '0.5rem' }}>Author: {name}</h1>
        <p>
          Contributed to {contributions.length} sprite version{contributions.length === 1 ? '' : 's'}.
        </p>
      </div>

      <div className={styles.characterGrid}>
        {contributions.map(({ code, sheet, character, authorsWithRelations }) => {
          const authorRelation = authorsWithRelations.find(a => a.name === name)?.relation;
          return (
            <div key={`${code}-${sheet.commitSha}`} className={styles.characterItem}>
              <div className={styles.characterDetails}>
                <h2 className={styles.characterName}>
                  <Link to={`/character/${code}`}>
                    {character.freedoomName || code}
                  </Link>
                </h2>
                
                {authorRelation && (
                  <div className={styles.metaGroup}>
                    <div className={styles.metaLabel}>{name} role</div>
                    <div className={styles.metaValue}>
                      {authorRelation}
                    </div>
                  </div>
                )}

                <div className={styles.metaGroup}>
                  <div className={styles.metaLabel}>Source</div>
                  <div className={styles.metaValue} style={{ textTransform: 'capitalize' }}>
                    {sheet.commitUrl.includes("/attic/") ? "attic" : "freedoom"}
                  </div>
                </div>

                <div className={styles.metaGroup}>
                  <div className={styles.metaLabel}>Date</div>
                  <div className={styles.metaValue}>
                    {new Date(sheet.commitDate).toISOString().slice(0, 10)}
                  </div>
                </div>

                <div className={styles.metaGroup}>
                  <div className={styles.metaLabel}>Commit</div>
                  <div className={styles.metaValue}>
                    <a 
                      href={sheet.commitUrl} 
                      title={sheet.commitMessage}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {sheet.commitSha.slice(0, 7)}
                    </a>
                  </div>
                </div>

                <div className={styles.metaGroup}>
                  <div className={styles.metaLabel}>Message</div>
                  <div className={styles.metaValue} style={{ 
                    fontSize: '0.8rem', 
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {sheet.commitMessage}
                  </div>
                </div>
              </div>
              <Animator code={code} version={sheet} meta={character} authorName={name} />
            </div>
          );
        })}
      </div>
    </>
  );
}
