import type { CharacterCode } from "@freedoom-bestiary/database/schema";
import type { Character } from "@freedoom-bestiary/database/schema";
import { SpritesheetPreview } from "~/shared/characters/spritesheet-preview/SpritesheetPreview";

type RouteData = {
	code: CharacterCode;
	character: Character;
	id: string;
};

export function meta({ data }: { data: RouteData | undefined }) {
	if (!data) {
		return [{ title: "Spritesheet Not Found - Freedoom Bestiary" }];
	}

	const { character, code } = data;
	return [
		{ title: `${character.freedoomName || code} Version - Freedoom Bestiary` },
		{
			name: "description",
			content: `Historical spritesheet for ${character.freedoomName || code}`,
		},
	];
}

export async function loader({ params }: { params: { code: string; id: string } }) {
	const { CharacterRepository } = await import("../repositories.server");
	const code = params.code.toUpperCase() as CharacterCode;
	const character = CharacterRepository.getCharacter(code);

	return {
		code,
		character,
		id: params.id,
	};
}

export default function CharacterSpritesheetDetail() {
	return <SpritesheetPreview />;
}