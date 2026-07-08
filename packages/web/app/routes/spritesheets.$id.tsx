import type { CharacterCode } from "@freedoom-bestiary/database/schema";
import type { Character } from "@freedoom-bestiary/database/schema";
import {
  CharacterRepository,
  SpritesheetRepository,
} from "@freedoom-bestiary/database";
import { SpritesheetPreview } from "~/pages/charactersList/spritesheet-preview/SpritesheetPreview";

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
    { title: `${character.freedoomName || code} - Freedoom Bestiary` },
    {
      name: "description",
      content: `Historical spritesheet for ${character.freedoomName || code}`,
    },
  ];
}

export async function loader({ params }: { params: { id: string } }) {
  const allSheets = await SpritesheetRepository.getAllSpritesheets();
  let code: CharacterCode | undefined;
  
  for (const [charCode, sheets] of Object.entries(allSheets)) {
    if (params.id in sheets) {
      code = charCode as CharacterCode;
      break;
    }
  }

  if (!code) {
    throw new Response("Spritesheet not found", { status: 404 });
  }

  const character = CharacterRepository.getCharacter(code);
  
  return {
    code,
    character,
    id: params.id,
  };
}

export default function SpritesheetDetail() {
  return <SpritesheetPreview />;
}
