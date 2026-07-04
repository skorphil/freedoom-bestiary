import { Outlet } from "react-router"
import CharacterSnippet from "./CharacterSnippet"

/**
  * New component
  */
function CharactersList() {
  return (
    <div>
      <CharacterSnippet title="123"  />
      <CharacterSnippet title="123"  />
      <CharacterSnippet title="123" secondaryText="lolojs" />
      <Outlet />
    </div>
    
  )
}

export default CharactersList
