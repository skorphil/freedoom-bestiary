import type {
	AnimationName,
	CharacterCode,
} from "@freedoom-bestiary/database/schema";
import { useMemo, useRef } from "react";
import { useParams } from "react-router";
import { useMediaQuery } from "~/pages/charactersList/useMediaQuery";
import { useAnimation } from "~/src/components/animator/useAnimation";
import { useSpritesheets } from "~/src/context/SpritesheetsContext";
import { PreviewControls } from "./PreviewControls";
import { PreviewHeader } from "./PreviewHeader";
import styles from "./SpritesheetPreview.module.css";

export function SpritesheetPreview() {
	const params = useParams();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const collection = useSpritesheets();
	const isCompact = useMediaQuery("(max-width: 1279px)");
	const isMobile = useMediaQuery("(max-width: 767px)");

	const spritesheet = useMemo(() => {
		if (params.id) {
			return collection.getByUuid(params.id);
		}
		if (params.code) {
			return collection.getLatest(params.code.toUpperCase() as CharacterCode);
		}
		return undefined;
	}, [params.id, params.code, collection]);

	const {
		animName,
		setAnimName,
		angle,
		setAngle,
		isReady,
		error,
		animations,
		currentAngles,
		stageSize,
		characterName,
	} = useAnimation({
		canvasRef,
		uuid: spritesheet?.id || "",
		initialAnimation: "idling" as AnimationName,
		initialAngle: 1,
	});

	if (!params.id && !params.code) {
		return <div>Error: No spritesheet ID or Character Code provided</div>;
	}

	if (error) {
		return <div>Error: {error}</div>;
	}

	if (!spritesheet || !isReady) {
		return <div>Loading...</div>;
	}

	const spritesHref = `/character/${spritesheet.code.toLowerCase()}`;

	const commitDate = spritesheet.data.commitDate
		? new Date(spritesheet.data.commitDate).toISOString().split("T")[0]
		: undefined;

	const metaValue = [commitDate, spritesheet.data.commitSha?.substring(0, 7)]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className={styles.container}>
			<div className={styles.layout}>
				<div className={`${styles.sidePanel} ${isCompact ? "" : styles.lg}`}>
					<PreviewHeader
						characterName={characterName || ""}
						isMobile={isMobile}
						spritesHref={spritesHref}
					/>
					{metaValue && (
						<div className={styles.metaBlock}>
							<span className={styles.metaLabel}>Version Git Commit</span>
							{spritesheet.data.commitUrl ? (
								<a
									href={spritesheet.data.commitUrl}
									target="_blank"
									rel="noopener noreferrer"
									className={styles.metaValue}
								>
									{metaValue}
								</a>
							) : (
								<span className={styles.metaValue}>{metaValue}</span>
							)}
						</div>
					)}
          
					{isCompact && (
						<div className={styles.canvasSection}>
							<canvas
								ref={canvasRef}
								className={styles.canvas}
								style={{
									aspectRatio: `${stageSize.width} / ${stageSize.height}`,
								}}
							/>
						</div>
					)}
					<PreviewControls
						animations={animations}
						currentAnimation={animName}
						availableAngles={currentAngles}
						currentAngle={angle}
						variant={isCompact ? "sm" : undefined}
						onAnimationChange={(anim) => setAnimName(anim as AnimationName)}
						onAngleChange={setAngle}
					/>
				</div>

				{isCompact || (
					<div className={styles.canvasSection}>
						<canvas
							ref={canvasRef}
							className={styles.canvas}
							style={{
								aspectRatio: `${stageSize.width} / ${stageSize.height}`,
							}}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
