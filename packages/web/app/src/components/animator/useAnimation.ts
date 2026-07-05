import type { AnimationName } from "@freedoom-bestiary/database/schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSpritesheets } from "../../context/SpritesheetsContext";
import type { RenderTask } from "../../models/Spritesheet.ts";
import { useAnimationLoop } from "./useAnimationLoop.ts";

export type UseAnimationOptions = {
	uuid: string;
	initialAnimation?: AnimationName;
	initialAngle?: number;
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
};

export function useAnimation({
	uuid,
	initialAnimation = "idling",
	initialAngle = 1,
	canvasRef,
}: UseAnimationOptions) {
	const collection = useSpritesheets();
	const [animName, setAnimName] = useState<AnimationName>(initialAnimation);
	const [angle, setAngle] = useState(initialAngle);

	const [error, setError] = useState<string | null>(null);

	// Resolve Spritesheet model and metadata from the global collection
	const spritesheet = useMemo(
		() => collection.getByUuid(uuid),
		[collection, uuid],
	);

	// Wait for image to load
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		if (!spritesheet) {
			setError(`Spritesheet ${uuid} not found`);
			return;
		}

		let cancelled = false;

		spritesheet
			.ready()
			.then(() => {
				if (!cancelled) {
					setIsReady(true);
					setError(null);
				}
			})
			.catch((err) => {
				if (!cancelled) {
					setError(`Failed to load spritesheet ${uuid}: ${err.message}`);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [spritesheet, uuid]);

	const animationsData = useMemo(() => {
		return isReady && spritesheet ? spritesheet.getAnimations() : {};
	}, [spritesheet, isReady]);

	const animations = useMemo(() => {
		return Object.keys(animationsData) as AnimationName[];
	}, [animationsData]);

	const currentAngles = useMemo(() => {
		return animationsData[animName]?.angles ?? [1];
	}, [animationsData, animName]);

	// Ensure animName is valid for the current spritesheet
	useEffect(() => {
		if (isReady && animations.length > 0 && !animations.includes(animName)) {
			setAnimName(animations[0]);
		}
	}, [animations, animName, isReady]);

	// Ensure angle is valid for the current animation
	useEffect(() => {
		if (isReady && currentAngles.length > 0 && !currentAngles.includes(angle)) {
			setAngle(currentAngles[0]);
		}
	}, [currentAngles, angle, isReady]);

	// The generator for the current animation state
	const generator = useMemo(() => {
		if (!isReady || !spritesheet) return undefined;
		const activeAnim = animations.includes(animName) ? animName : animations[0];
		if (!activeAnim) return undefined;

		try {
			return spritesheet.play(activeAnim, angle);
		} catch (e) {
			console.error(e);
			return undefined;
		}
	}, [spritesheet, animName, angle, animations, isReady]);

	// The rendering callback
	const onTick = useCallback(
		(task: RenderTask) => {
			const canvas = canvasRef.current;
			const ctx = canvas?.getContext("2d");
			if (!canvas || !ctx) return;

			const stageWidth = task.stageSize.width;
			const stageHeight = task.stageSize.height * 1.2;

			// Ensure canvas internal resolution matches the stage size (with 1.2 aspect correction)
			if (canvas.width !== stageWidth || canvas.height !== stageHeight) {
				canvas.width = stageWidth;
				canvas.height = stageHeight;
			}

			ctx.imageSmoothingEnabled = false;
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			if (task.image.complete) {
				// doom sprites are rendered with 1.2 aspect ratio correction
				// the sprites are already pre-aligned to bottom-center in the spritesheet cells
				ctx.drawImage(
					task.image,
					task.source.x,
					task.source.y,
					task.source.width,
					task.source.height,
					0,
					0,
					task.source.width,
					task.source.height * 1.2,
				);
			}
		},
		[canvasRef],
	);

	useAnimationLoop(generator, onTick);

	const stageSize = useMemo(
		() =>
			isReady && spritesheet
				? spritesheet.getStageSize()
				: { width: 64, height: 64 },
		[spritesheet, isReady],
	);

	return {
		animName,
		setAnimName,
		angle,
		setAngle,
		isReady,
		error,
		animations,
		currentAngles,
		stageSize,
		characterName: spritesheet?.getCharacterName(),
		characterDescription: spritesheet?.getCharacterDescription(),
	};
}
