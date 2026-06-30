import { useLoaderData, Link } from "react-router";
import styles from "../src/components/CharacterItem.module.css";
import { Header } from "../src/components/Header.tsx";
import { Animator } from "../src/components/animator/Animator.tsx";
import { bestiary } from "../src/models/SpritesheetsCollection.ts";
import spriteMeta from "@sprites_meta/sprites_meta.json";
import type { Route } from "./+types/authors.$name";

export function meta({ params }: Route.MetaArgs) {
  const name = decodeURIComponent(params.name || "");
  return [
    { title: `${name} - Contributions - Freedoom Bestiary` },
    { name: "description", content: `Sprite versions contributed by ${name}` },
  ];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const name = decodeURIComponent(params.name || "");
  const contributions = bestiary.getAuthorContributions(name);

  return {
    name,
    contributions,
  };
}

export default function AuthorPage() {
  const { name, contributions } = useLoaderData<typeof clientLoader>();

  return (
    <>
      <Header />
      
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{fontSize: "40px", color: 'white', marginBottom: '0.5rem' }}>Author: {name}</h1>
        <p style={{ color: '#aaa', fontSize: '1.1rem' }}>
          Contributed to {contributions.length} sprite version{contributions.length === 1 ? '' : 's'}.
        </p>
      </div>

      <div className={styles.characterGrid}>
        {contributions.map(({ code, version }) => {
          const meta = (spriteMeta as any).find((m: any) => m.sprite === code);
          const authorRelation = version.authors.find(a => a.name === name)?.relation;
          return (
            <div key={`${code}-${version.sha}`} className={styles.characterItem}>
              <div className={styles.characterDetails}>
                <h2 className={styles.characterName}>
                  <Link to={`/character/${code}`}>
                    {meta?.freedoomName || code}
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
              {meta && <Animator code={code} version={version} meta={meta} authorName={name} />}
            </div>
          );
        })}
      </div>
    </>
  );
}
