import {
	CharacterRepository,
	SpritesheetRepository,
} from "@freedoom-bestiary/database";
import type { Config } from "@react-router/dev/config";

export default {
	ssr: true,
	basename: "/freedoom-bestiary/",
	async prerender() {
		const spritesheetsMap = await SpritesheetRepository.getAllSpritesheets();

		const spritesheetPaths = Object.values(spritesheetsMap).flatMap(
			(characterGroup) =>
				Object.keys(characterGroup).map((id) => `/${id}`),
		);

		return ["/", ...spritesheetPaths];
	},
} satisfies Config;
