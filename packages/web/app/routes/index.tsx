import { Outlet, useMatches } from "react-router";
import CharactersList from "~/pages/charactersList/CharactersList.tsx";
import styles from "./index.module.css";

export function meta() {
	return [
		{ title: "Freedoom Bestiary" },
		{ name: "description", content: "Sprites gallery from FreeDoom" },
	];
}

export default function Index() {
	const matches = useMatches();
	const lastMatch = matches[matches.length - 1];
	const isRoot = lastMatch?.pathname === "/";

	return (
		<div className={styles.layoutArea}>
			<div
				className={`
        ${styles.snippetList}
        ${isRoot ? styles.activePanel : styles.inactivePanel}
      `}
			>
				<CharactersList />
			</div>
			<div
				className={`
        ${styles.contentArea}
        ${!isRoot ? styles.activePanel : styles.inactivePanel}
      `}
			>
				<Outlet />
			</div>
		</div>
	);
}
