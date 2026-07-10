import { useSpritesheets } from "~/src/context/SpritesheetsContext";
import SpritesheetSnippet from "~/shared/characters/SpritesheetSnippet";
import styles from "~/shared/characters/SpritesheetSnippet.module.css";

type AuthorContributionsListProps = {
	authorId: string;
};

/**
 * Displays a list of all contributions for a specific author, sorted by date (newest first)
 */
export function AuthorContributionsList({ authorId }: AuthorContributionsListProps) {
	const collection = useSpritesheets();
	
	// Resolve author ID to name
	const authorName = collection.getContributorName(authorId);
	
	// Get all contributions for this author
	const contributions = collection.getAuthorContributions(authorName);

	return (
		<div className={styles.characterGrid}>
			{contributions.map(({ code, sheet }) => (
				<SpritesheetSnippet
					key={sheet.id}
					spritesheetId={sheet.id}
					title={`${code}: ${new Date(sheet.data.commitDate).toISOString().split("T")[0]}`}
					to={`/authors/${authorId}/${sheet.id}`}
				/>
			))}
		</div>
	);
}