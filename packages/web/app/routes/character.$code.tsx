import { Link } from "react-router";
import styles from "../src/components/CharacterItem.module.css";
import { Header } from "../src/components/Header.tsx";
import { Animator } from "../src/components/animator/Animator.tsx";
import { createSpritesheetsCollection } from "../src/models/SpritesheetsCollection.ts";
import { SpritesheetRepository, CharacterRepository } from "@freedoom-bestiary/database";
import type { Route } from "./+types/character.$code";
import type { CharacterCode, Spritesheet } from "@freedoom-bestiary/database";

export function meta({ params }: Route.MetaArgs) {
  const code = params.code as CharacterCode;
  const character = CharacterRepository.getCharacter(code);
  return [
    { title: `${character.freedoomName || code} - Freedoom Bestiary` },
    { name: "description", content: `Historical spritesheets for ${character.freedoomName || code}` },
  ];
}

// This runs at BUILD TIME during SSG
export async function loader({ params }: Route.LoaderArgs) {
  const code = params.code.toUpperCase() as CharacterCode;
  
  const allSheets = await SpritesheetRepository.getAllSpritesheets();
  const collection = createSpritesheetsCollection(allSheets);
  
  const history = collection.getHistory(code);
  const character = CharacterRepository.getCharacter(code);
  
  // Sort: Freedoom first (by date desc), then Attic (by date desc)
  const freedoomVersions = history
    .filter((v) => !collection.isAtticEntry(v))
    .sort((a, b) => new Date(b.commitDate).getTime() - new Date(a.commitDate).getTime());
  
  const atticVersions = history
    .filter((v) => collection.isAtticEntry(v))
    .sort((a, b) => new Date(b.commitDate).getTime() - new Date(a.commitDate).getTime());

  const sortedHistory = [...freedoomVersions, ...atticVersions];

  return {
    code,
    history: sortedHistory,
    character,
    // Provide a way to get authors in component
    authorsMap: sortedHistory.reduce((acc, sheet) => {
      // Resolve IDs to names here in loader
      const authors = sheet.contributions.map(c => {
        try {
          return {
            name: ContributorRepository.getContributorById(c.contributorId).name,
            relation: c.relation
          };
        } catch {
          return { name: c.contributorId, relation: c.relation };
        }
      });
      acc[sheet.spritesheetId] = authors;
      return acc;
    }, {} as Record<string, { name: string; relation?: string }[]>)
  };
}

export default function CharacterDetail({ loaderData }: Route.ComponentProps) {
  const { code, history, character, authorsMap } = loaderData;

  return (
    <>
      <Header />
      
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{fontSize: "40px", marginBottom: '0.5rem' }}>{character.freedoomName || code}</h1>
        <p>{character.description}</p>
      </div>

      <div className={styles.characterGrid}>
        {history.map((version) => (
          <div key={version.spritesheetId} className={styles.characterItem}>
            <div className={styles.characterDetails}>
              <div className={styles.metaGroup}>
                <div className={styles.metaLabel}>Source</div>
                <div className={styles.metaValue} style={{ textTransform: 'capitalize' }}>
                  {version.commitUrl.includes("/attic/") ? "attic" : "freedoom"}
                </div>
              </div>

              <div className={styles.metaGroup}>
                <div className={styles.metaLabel}>Date</div>
                <div className={styles.metaValue}>
                  {new Date(version.commitDate).toISOString().slice(0, 10)}
                </div>
              </div>

              <div className={styles.metaGroup}>
                <div className={styles.metaLabel}>Authors</div>
                <div className={styles.metaValue}>
                  {authorsMap[version.spritesheetId].map(a => a.name).join(", ")}
                </div>
              </div>

              <div className={styles.metaGroup}>
                <div className={styles.metaLabel}>Commit</div>
                <div className={styles.metaValue}>
                  <a 
                    href={version.commitUrl} 
                    title={version.commitMessage}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {version.commitSha.slice(0, 7)}
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
                  {version.commitMessage}
                </div>
              </div>
            </div>
            <Animator code={code} version={version} meta={character} />
          </div>
        ))}
      </div>
    </>
  );
}
