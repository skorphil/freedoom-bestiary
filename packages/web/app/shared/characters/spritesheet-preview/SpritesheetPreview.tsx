import type { AnimationName } from "@freedoom-bestiary/database/schema";
import { ReactElement, useMemo, useRef } from "react";
import { Link, useParams } from "react-router";
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
		const id = params.id || params.slug;
		if (id) {
			return collection.getByUuid(id);
		}
	}, [params.id, params.slug, collection]);

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
	const spritesHref = `/${spritesheet.code.toLowerCase()}`;
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
					<Link to={`/${code.toLowerCase()}`}>{versionsCount} versions</Link>
				</MetaBlock>
				<MetaBlock key="Authors" label="All character contributors">
					<div className={styles.authorsList}>
						{allAuthors.map((authorName, index) => {
							// Find the contributor ID for this author name
							const contributorId = collection.getContributorIdByName(authorName);

							return (
								<span key={authorName}>
									{contributorId ? (
										<a href={`/freedoom-bestiary/authors/${contributorId}`}>{authorName}</a>
									) : (
										authorName
									)}
									{index < allAuthors.length - 1 ? ", " : ""}
								</span>
							);
						})}
					</div>
				</MetaBlock>
			</div>

			<div className={styles.metaListFull}>
				<MetaBlock key="Version contributors" label="Current version contributors">
					<div className={styles.authorsList}>
						{spritesheetAuthors.map((authorName, index) => {
							// Find the contributor ID for this author name
							const contributorId = collection.getContributorIdByName(authorName);

							return (
								<span key={authorName}>
									{contributorId ? (
										<a href={`/freedoom-bestiary/authors/${contributorId}`}>{authorName}</a>
									) : (
										authorName
									)}
									{index < spritesheetAuthors.length - 1 ? ", " : ""}
								</span>
							);
						})}
					</div>
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
