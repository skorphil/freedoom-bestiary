import { useRef } from "react";
import { useNavigate } from "react-router";
import { useAnimation } from "~/src/components/animator/useAnimation";
import styles from "./CharacterSnippet.module.css";

type CharacterSnippetProps = {
	spritesheetId: string;
	title: string;
	secondaryText?: string;
};

/** Snippet, showcasing given spritesheet */
function CharacterSnippet({
	secondaryText,
	title,
	spritesheetId,
}: CharacterSnippetProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const navigate = useNavigate();
	useAnimation({
		canvasRef,
		uuid: spritesheetId,
		initialAnimation: "chasing",
		initialAngle: 2,
	});

	return (
		<div
			role="link"
			onClick={() => navigate(`/${spritesheetId}`)}
			className={styles.snippetContainer}
		>
			<p className={styles.title}>{title}</p>
			<p className={styles.footer}>{secondaryText}</p>
			<canvas className={styles.spriteContainer} ref={canvasRef} />
		</div>
	);
}

export default CharacterSnippet;
