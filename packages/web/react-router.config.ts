import { SpritesheetRepository } from "@freedoom-bestiary/database";
import type { Config } from "@react-router/dev/config";

export default {
	ssr: true,
	basename: "/freedoom-bestiary/",
	async prerender() {
		const allSheets = await SpritesheetRepository.getAllSpritesheets();
		const characterCodes = Object.keys(allSheets);

		return ["/", ...characterCodes.map((code) => `/character/${code}`)];
	},
} satisfies Config;
