import { useRef } from "react";
import { useNavigate } from "react-router";
import { useAnimation } from "~/src/components/animator/useAnimation";
import styles from "./SpritesheetSnippet.module.css";

type SpritesheetSnippetProps = {
	spritesheetId: string;
	title: string;
	secondaryText?: string;
	to?: string;
};

/** Snippet, showcasing given spritesheet */
function SpritesheetSnippet({
	secondaryText,
	title,
	spritesheetId,
	to,
}: SpritesheetSnippetProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const navigate = useNavigate();
	const { stageSize } = useAnimation({
		canvasRef,
		uuid: spritesheetId,
		initialAnimation: "chasing",
		initialAngle: 2,
	});

	const handleClick = () => {
		if (to) {
			navigate(to);
		} else {
			navigate(`/${spritesheetId}`);
		}
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleClick();
		}
	};

	return (
		<button
			type="button"
			onKeyDown={onKeyDown}
			onClick={handleClick}
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

export default SpritesheetSnippet;
