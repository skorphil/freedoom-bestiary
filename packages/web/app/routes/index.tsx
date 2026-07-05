import CharactersList from "~/pages/charactersList/CharactersList.tsx";
import { Header } from "../src/components/Header.tsx";
import type { Route } from "./+types/index";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Freedoom Bestiary" },
		{ name: "description", content: "Sprites gallery from FreeDoom" },
	];
}

export default function Index() {
	return (
		<>
			<Header />
			<CharactersList />
		</>
	);
}
