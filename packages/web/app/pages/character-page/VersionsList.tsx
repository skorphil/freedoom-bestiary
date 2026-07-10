import { useSpritesheets } from "~/src/context/SpritesheetsContext";
import SpritesheetSnippet from "~/shared/characters/SpritesheetSnippet";
import styles from "~/shared/characters/SpritesheetSnippet.module.css";
import type { CharacterCode } from "@freedoom-bestiary/database/schema";

type VersionsListProps = {
	spriteCode: CharacterCode;
};

/**
 * Displays a list of all versions for a specific character, sorted by date (newest first)
 */
export function VersionsList({ spriteCode }: VersionsListProps) {
	const collection = useSpritesheets();

	const versions = collection
		.getHistory(spriteCode)
		.sort((a, b) => new Date(b.data.commitDate).getTime() - new Date(a.data.commitDate).getTime());

	return (
		<div className={styles.characterGrid}>
			{versions.map((version) => (
				<SpritesheetSnippet
					key={version.id}
					spritesheetId={version.id}
					title={new Date(version.data.commitDate).toISOString().split("T")[0]}
					to={`/${spriteCode.toLowerCase()}/${version.id}`}
				/>
			))}
		</div>
	);
}
