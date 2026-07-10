import type { AnimationName } from "@freedoom-bestiary/database/schema";
import { ReactElement, useMemo, useRef } from "react";
import { useParams } from "react-router";
import { useAnimation } from "~/src/components/animator/useAnimation";
import { useSpritesheets } from "~/src/context/SpritesheetsContext";
import { PreviewControls } from "./PreviewControls";
import { PreviewHeader } from "./PreviewHeader";
import styles from "./SpritesheetPreview.module.css";

export function SpritesheetPreview() {
	const params = useParams();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const collection = useSpritesheets();

	const spritesheet = useMemo(() => {
		if (params.id) {
			return collection.getByUuid(params.id);
		}
	}, [params.id, collection]);

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
		characterDescription, // TODO move to collection?
	} = useAnimation({
		canvasRef,
		uuid: spritesheet?.id || "",
		initialAnimation: "idling" as AnimationName,
		initialAngle: 1,
	});

	if (error) return <div>Error: {error}</div>;
	if (!spritesheet || !isReady) return <div>Loading...</div>;

	const code = spritesheet.code;
	const allAuthors = collection.getAuthors(code);
	const spritesheetAuthors = collection.getUniqueAuthors(spritesheet);
	const versionsCount = collection.getHistory(code).length;
	const spritesHref = `/character/${spritesheet.code.toLowerCase()}`;
	const commitDate = new Date(spritesheet.data.commitDate).toISOString().split("T")[0];
	const commitUrl = spritesheet.data.commitUrl;
	const commitUrlLabel = [commitDate, spritesheet.data.commitSha.substring(0, 7)]
		.filter(Boolean)
		.join(" | ");

	return (
		<div className={styles.previewLayout}>
			<div className={styles.previewHeader}>
				<PreviewHeader characterName={characterName || ""} spritesHref={spritesHref} />
			</div>
			<div className={styles.metaListMini}>
				<MetaBlock key="Descr" label="Description">
					<span>{characterDescription}</span>
				</MetaBlock>
				<MetaBlock key="Versions" label="Versions Total">
					<span>{versionsCount} versions</span>
					{/* TODO URL to character page */}
				</MetaBlock>
				<MetaBlock key="Authors" label="All character contributors">
					<span>{allAuthors.join(", ")}</span>
					{/* TODO URL to author page */}
				</MetaBlock>
			</div>

			<div className={styles.metaListFull}>
				<MetaBlock key="Version contributors" label="Current version contributors">
					<span>{spritesheetAuthors.join(", ")}</span>
				</MetaBlock>
				<MetaBlock key="Commit" label="Version Commit">
					<a href={commitUrl}>{commitUrlLabel}</a>
				</MetaBlock>
			</div>

			<div className={styles.preview}>
				<canvas
					ref={canvasRef}
					className={styles.canvas}
					style={{
						aspectRatio: `${stageSize.width} / ${stageSize.height}`,
					}}
				/>
			</div>
			<div className={styles.previewControls}>
				<PreviewControls
					animations={animations}
					currentAnimation={animName}
					availableAngles={currentAngles}
					currentAngle={angle}
					onAnimationChange={(anim) => setAnimName(anim as AnimationName)}
					onAngleChange={setAngle}
				/>
			</div>
		</div>
	);
}

type MetaBlockProps = {
	children: ReactElement;
	label: string;
};

function MetaBlock({ children, label }: MetaBlockProps) {
	return (
		<div className={styles.previewMetaBlock}>
			<span className={styles.previewMetaLabel}>{label}</span>
			{children}
		</div>
	);
}
