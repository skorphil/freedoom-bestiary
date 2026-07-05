import type {
	CharactersMap,
	ContributorsMap,
	SpritesheetsMap,
} from "@freedoom-bestiary/database/schema";
import { createContext, useContext, useMemo } from "react";
import {
	createSpritesheetsCollection,
	type SpritesheetsCollection,
} from "../models/SpritesheetsCollection";

const SpritesheetsContext = createContext<SpritesheetsCollection | null>(null);

export function SpritesheetsProvider({
	data,
	characters,
	contributors,
	children,
}: {
	data: SpritesheetsMap;
	characters: CharactersMap;
	contributors: ContributorsMap;
	children: React.ReactNode;
}) {
	const collection = useMemo(
		() => createSpritesheetsCollection(data, characters, contributors),
		[data, characters, contributors],
	);

	return (
		<SpritesheetsContext.Provider value={collection}>
			{children}
		</SpritesheetsContext.Provider>
	);
}

export function useSpritesheets() {
	const context = useContext(SpritesheetsContext);
	if (!context) {
		throw new Error(
			"useSpritesheets must be used within a SpritesheetsProvider",
		);
	}
	return context;
}
