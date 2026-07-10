import { useSpritesheets } from "~/src/context/SpritesheetsContext";
import SpritesheetSnippet from "~/shared/characters/SpritesheetSnippet";
import styles from "~/shared/characters/SpritesheetSnippet.module.css";
import { useHydrated } from "~/shared/hooks/useHydrated";

type SpritesheetSnippetData = {
	spriteCode: string;
	spritesheetId: string;
	title: string;
	secondaryText?: string;
};

function CharactersList() {
	const { getAllCodes, getLatest } = useSpritesheets();
	const isHydrated = useHydrated();
	const codes = getAllCodes();

	const characterSnippets: SpritesheetSnippetData[] = codes
		.map((spriteCode) => {
			const latestSpritesheet = getLatest(spriteCode);
			if (!latestSpritesheet) {
				return null;
			}

			return {
				spriteCode,
				spritesheetId: latestSpritesheet.id,
				title: latestSpritesheet.getCharacterName(),
				secondaryText: isHydrated ? latestSpritesheet.getDate() : "",
			};
		})
		.filter(Boolean) as SpritesheetSnippetData[];

	return (
		<div className={styles.characterGrid}>
			{characterSnippets.map(({ spritesheetId, title, secondaryText }) => (
				<SpritesheetSnippet
					key={spritesheetId}
					spritesheetId={spritesheetId}
					title={title}
					secondaryText={secondaryText}
					to={`/${spritesheetId}`}
				/>
			))}
		</div>
	);
}

export default CharactersList;
