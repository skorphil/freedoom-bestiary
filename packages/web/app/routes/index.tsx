import CharactersList from "~/pages/charactersList/CharactersList.tsx";
import { Header } from "../src/components/Header.tsx";
import { createSpritesheetsCollection } from "../src/models/SpritesheetsCollection.ts";
import { SpritesheetRepository, CharacterRepository } from "@freedoom-bestiary/database";
import type { Route } from "./+types/index";
import type { CharacterCode } from "@freedoom-bestiary/database";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Freedoom Bestiary" },
    { name: "description", content: "Sprites gallery from FreeDoom" },
  ];
}

// This runs at BUILD TIME during SSG
export async function loader() {
  const allSheets = await SpritesheetRepository.getAllSpritesheets();
  const collection = createSpritesheetsCollection(allSheets);
  
  const characters = collection.getAllCodes().map(code => {
    const history = collection.getHistory(code);
    const latest = collection.getLatestLiveEntry(history);
    const character = CharacterRepository.getCharacter(code);
    const authors = latest ? collection.getUniqueAuthors(latest) : [];
    
    return {
      code,
      name: character.freedoomName,
      description: character.description,
      latest,
      authors,
    };
  }).filter((entry): entry is typeof entry & { latest: NonNullable<typeof entry.latest> } => entry.latest !== undefined);
  
  return { characters };
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { characters } = loaderData;

  return (
    <>
      <Header />
      <CharactersList characters={characters} />
    </>
  );
}
