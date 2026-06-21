import { CharacterItem } from "./components/CharacterItem.tsx";

export const layout = "main.tsx";
export const title = "Freedoom Bestiary";

export default (data: Lume.Data) => (
	<>
		<h1>{data.title}</h1>
    <p>Sprites gallery from <a href="https://freedoom.github.io/">FreeDoom</a></p>
    <div className="character-grid">
      <CharacterItem/>
      <CharacterItem/>
      <CharacterItem/>
      <CharacterItem/>
      <CharacterItem/>
    </div>
    
	</>
);
