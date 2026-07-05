import { useRef } from 'react'
import styles from './CharacterSnippet.module.css'
import { useNavigate } from 'react-router'
import { Spritesheet } from '~/src/models/Spritesheet'

type CharacterSnippetProps = {
  spritesheet: Spritesheet
  title: string,
  secondaryText?: string,
}

/** Snippet, showcasing given spritesheet */
function CharacterSnippet({secondaryText, title, spritesheet}: CharacterSnippetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const navigate = useNavigate()

  return (
    <div role="link" onClick={() => navigate(`/character/${spritesheet.code}`)} className={styles.snippetContainer}>
      <p className={styles.title}>{title}</p>
      <p className={styles.footer}>{secondaryText}</p>
      <canvas className={styles.spriteContainer} ref={canvasRef}/>
    </div>
  )
}

export default CharacterSnippet
