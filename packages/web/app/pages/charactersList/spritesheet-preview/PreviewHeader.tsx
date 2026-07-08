import styles from "./PreviewHeader.module.css";

type PreviewHeaderProps = {
  characterName: string;
  isMobile: boolean;
  spritesHref: string;
};

export function PreviewHeader({
  characterName,
  isMobile,
  spritesHref,
}: PreviewHeaderProps) {
  return (
    <header className={`${styles.header} ${isMobile ? styles.sm : styles.lg}`}>
      <h2 className={styles.title}>{characterName}</h2>
      <a href={spritesHref} className={styles.spritesLink}>
        sprites
      </a>
    </header>
  );
}
