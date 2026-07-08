import type { CharacterCode } from "@freedoom-bestiary/database";
import {
  CharacterRepository,
} from "@freedoom-bestiary/database";
import { SpritesheetPreview } from "~/pages/charactersList/spritesheet-preview/SpritesheetPreview";

export function meta({ params }: { params: { code: string } }) {
  const code = params.code as CharacterCode;
  const character = CharacterRepository.getCharacter(code);
  return [
    { title: `${character.freedoomName || code} - Freedoom Bestiary` },
    {
      name: "description",
      content: `Historical spritesheets for ${character.freedoomName || code}`,
    },
  ];
}

export async function loader({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase() as CharacterCode;
  const character = CharacterRepository.getCharacter(code);
  
  return {
    code,
    character,
  };
}

export default function CharacterDetail() {
  return <SpritesheetPreview />;
}