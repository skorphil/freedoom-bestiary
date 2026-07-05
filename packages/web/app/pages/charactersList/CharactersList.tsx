import { Outlet } from "react-router";
import { useSpritesheets } from "~/src/context/SpritesheetsContext";
import CharacterSnippet from "./CharacterSnippet";
import styles from "./CharacterSnippet.module.css";
import { useHydrated } from "./useHydrated";

function CharactersList() {
	const { getAllCodes, getLatest } = useSpritesheets();
	const hydrated = useHydrated();

	const codes = getAllCodes();

	return (
		<div className={styles.characterGrid}>
			{codes.map((spriteCode) => {
				const latestSpritesheet = getLatest(spriteCode);
				if (!latestSpritesheet) return;
				const id = latestSpritesheet?.id;

				return (
					<CharacterSnippet
						key={id}
						spritesheetId={id}
						title={latestSpritesheet.getCharacterName()}
						secondaryText={hydrated ? latestSpritesheet.getDate() : ""}
					/>
				);
			})}

			<Outlet />
		</div>
	);
}

export default CharactersList;
