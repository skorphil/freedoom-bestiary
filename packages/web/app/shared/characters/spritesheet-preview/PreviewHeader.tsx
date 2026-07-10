import styles from "./PreviewHeader.module.css";

type PreviewHeaderProps = {
	characterName: string;
	spritesHref?: string;
};

export function PreviewHeader({ characterName, spritesHref }: PreviewHeaderProps) {
	return (
		<header className={styles.header}>
			<h2 className={styles.title}>{characterName}</h2>
			{spritesHref && (
				<a href={spritesHref} className={styles.spritesLink}>
					sprites
				</a>
			)}
		</header>
	);
}
