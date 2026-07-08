import { useSpritesheets } from "~/src/context/SpritesheetsContext";
import CharacterSnippet from "./CharacterSnippet";
import styles from "./CharacterSnippet.module.css";
import { useHydrated } from "./useHydrated";

function CharactersList() {
	const { getAllCodes, getLatest } = useSpritesheets();
	const isHydrated = useHydrated();
	const codes = getAllCodes();

	return (
		<div className={styles.characterGrid}>
			{codes.map((spriteCode) => {
				const latestSpritesheet = getLatest(spriteCode);
				if (!latestSpritesheet) return undefined;
				const id = latestSpritesheet.id;

				return (
					<CharacterSnippet
						key={id}
						spritesheetId={id}
						title={latestSpritesheet.getCharacterName()}
						secondaryText={isHydrated ? latestSpritesheet.getDate() : ""}
					/>
				);
			})}
		</div>
	);
}

export default CharactersList;
