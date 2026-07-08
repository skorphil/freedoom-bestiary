import { CharacterRepository } from "@freedoom-bestiary/database";
import type { Config } from "@react-router/dev/config";

export default {
	ssr: true,
	basename: "/freedoom-bestiary/",
	async prerender() {
		// const charactersCodes = CharacterRepository.getCharactersList();

		// const characterPaths = charactersCodes.map((code) => `/character/${code}`);
		// TODO contributorsPaths

		return ["/"];
	},
} satisfies Config;
