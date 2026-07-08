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
	const { stageSize } = useAnimation({
		canvasRef,
		uuid: spritesheetId,
		initialAnimation: "chasing",
		initialAngle: 2,
	});

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			navigate(`/spritesheets/${spritesheetId}`);
		}
	};

	return (
		<button
			type="button"
			onKeyDown={onKeyDown}
			onClick={() => navigate(`/spritesheets/${spritesheetId}`)}
			className={styles.snippetContainer}
		>
			<p className={styles.title}>{title}</p>
			<p className={styles.footer}>{secondaryText}</p>
			<div className={styles.spriteWrapper}>
				<canvas
					className={styles.spriteContainer}
					ref={canvasRef}
					style={{
						aspectRatio: `${stageSize.width} / ${stageSize.height * 1.2}`,
					}}
				/>
			</div>
		</button>
	);
}

export default CharacterSnippet;
