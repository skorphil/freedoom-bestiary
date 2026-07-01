import { useLoaderData, Link } from "react-router";
import styles from "../src/components/CharacterItem.module.css";
import { Header } from "../src/components/Header.tsx";
import { Animator } from "../src/components/animator/Animator.tsx";
import { bestiary } from "../src/models/SpritesheetsCollection.ts";
import spriteMeta from "@sprites_meta/sprites_meta.json";
import type { Route } from "./+types/character.$code";
import type { SpriteCode } from "../src/models/schema.ts";

export function meta({ params }: Route.MetaArgs) {
  const code = params.code as SpriteCode;
  const meta = (spriteMeta as any).find((m: any) => m.sprite === code);
  return [
    { title: `${meta?.freedoomName || code} - Freedoom Bestiary` },
    { name: "description", content: `Historical spritesheets for ${meta?.freedoomName || code}` },
  ];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const code = params.code as SpriteCode;
  const history = bestiary.getHistory(code);
  const meta = (spriteMeta as any).find((m: any) => m.sprite === code);

  // Sort: Freedoom first (by date desc), then Attic (by date desc)
  const freedoomVersions = history
    .filter((v) => v.source === "freedoom")
    .sort((a, b) => b.date.localeCompare(a.date));
  
  const atticVersions = history
    .filter((v) => v.source === "attic")
    .sort((a, b) => b.date.localeCompare(a.date));

  const sortedHistory = [...freedoomVersions, ...atticVersions];

  return {
    code,
    history: sortedHistory,
    meta,
  };
}

export default function CharacterDetail() {
  const { code, history, meta } = useLoaderData<typeof clientLoader>();

  return (
    <>
      <Header />
      
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{fontSize: "40px", marginBottom: '0.5rem' }}>{meta?.freedoomName || code}</h1>
        <p>{meta?.description}</p>
      </div>

      <div className={styles.characterGrid}>
        {history.map((version) => (
          <div key={version.sha} className={styles.characterItem}>
            <div className={styles.characterDetails}>
              <div className={styles.metaGroup}>
                <div className={styles.metaLabel}>Source</div>
                <div className={styles.metaValue} style={{ textTransform: 'capitalize' }}>
                  {version.source}
                </div>
              </div>

              <div className={styles.metaGroup}>
                <div className={styles.metaLabel}>Date</div>
                <div className={styles.metaValue}>
                  {new Date(version.date).toISOString().slice(0, 10)}
                </div>
              </div>

              <div className={styles.metaGroup}>
                <div className={styles.metaLabel}>Authors</div>
                <div className={styles.metaValue}>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {bestiary.getAuthorsWithRelations(version).map((author, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>
                        <Link to={`/authors/${author.name}`}>
                          <strong>{author.name}</strong>
                        </Link>
                        {author.relation && (
                          <span style={{ display: 'block', fontSize: '0.75rem' }}>
                            {author.relation}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
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
                    {version.sha.slice(0, 7)}
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
            {meta && <Animator code={code} version={version} meta={meta} />}
          </div>
        ))}
      </div>
    </>
  );
}
