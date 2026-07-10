import {
	ContributorRepository,
	SpritesheetRepository,
} from "@freedoom-bestiary/database";
import type { Config } from "@react-router/dev/config";

export default {
	ssr: true,
	basename: "/freedoom-bestiary/",
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

		return [
			"/",
			...rootSpritesheetPaths,
			...characterPaths,
			...nestedSpritesheetPaths,
			...authorPaths,
		];
	},
} satisfies Config;
