import CharactersList from "~/pages/charactersList/CharactersList.tsx";
import type { Route } from "./+types/index";
import styles from "./index.module.css";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Freedoom Bestiary" },
		{ name: "description", content: "Sprites gallery from FreeDoom" },
	];
}

export default function Index() {
	return (
		<div className={styles.contentArea}>
			<div className={styles.snippetList}>
				<CharactersList />
			</div>
			<div>
				<p>Preview</p>
			</div>
		</div>
	);
}
