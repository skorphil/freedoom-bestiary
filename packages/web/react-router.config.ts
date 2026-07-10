import {
	ContributorRepository,
	SpritesheetRepository,
} from "@freedoom-bestiary/database";
import type { Config } from "@react-router/dev/config";

export default {
	ssr: true,
	basename: "/freedoom-bestiary/",
	// Disable lazy route discovery — static hosts (GitHub Pages) can't serve /__manifest
	routeDiscovery: { mode: "initial" },
	async prerender() {
		const spritesheetsMap = await SpritesheetRepository.getAllSpritesheets();

		const rootSpritesheetPaths = Object.values(spritesheetsMap).flatMap(
			(characterGroup) =>
				Object.keys(characterGroup).map((id) => `/${id}`),
		);

		const characterPaths = Object.keys(spritesheetsMap).map(
			(code) => `/${code.toLowerCase()}`,
		);

		const nestedSpritesheetPaths = Object.entries(spritesheetsMap).flatMap(
			([code, characterGroup]) =>
				Object.keys(characterGroup).map(
					(id) => `/${code.toLowerCase()}/${id}`,
				),
		);

		const contributors = await ContributorRepository.getAllContributors();
		const authorPaths = Object.keys(contributors).map(
			(id) => `/authors/${id}`,
		);

		const authorSpritesheetPaths = Object.values(spritesheetsMap).flatMap(
			(characterGroup) =>
				Object.entries(characterGroup).flatMap(([sheetId, sheet]) => {
					const contributorIds = new Set<string>();
					for (const contrib of sheet.contributions) {
						contributorIds.add(contrib.contributorId);
					}
					for (const sprite of sheet.sprites) {
						for (const contrib of sprite.contributions) {
							contributorIds.add(contrib.contributorId);
						}
					}
					return [...contributorIds].map(
						(authorId) => `/authors/${authorId}/${sheetId}`,
					);
				}),
		);

		return [
			"/",
			...rootSpritesheetPaths,
			...characterPaths,
			...nestedSpritesheetPaths,
			...authorPaths,
			...authorSpritesheetPaths,
		];
	},
} satisfies Config;
