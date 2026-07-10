import type { AnimationName } from "@freedoom-bestiary/database/schema";

import { useRef } from "react";
import { Radio } from "../../../shared/ui/radio/Radio";
import styles from "./Animator.module.css";
import { useAnimation } from "./useAnimation.ts";

export type AnimatorProps = {
	uuid: string;
	initialAnimation?: AnimationName;
};

export function Animator({ uuid, initialAnimation = "idling" }: AnimatorProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
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
	} = useAnimation({
		uuid,
		initialAnimation,
		canvasRef,
	});

	const handleAngleChange = (delta: number) => {
		const currentIndex = currentAngles.indexOf(angle);
		if (currentIndex === -1) return;
		const nextIndex = (currentIndex + delta + currentAngles.length) % currentAngles.length;
		setAngle(currentAngles[nextIndex]);
	};

	return (
		<div
			className={styles.animator}
			style={{ position: "relative" }}
			data-ready={isReady ? "true" : "false"}
		>
			<div className={styles.animatorDisplay}>
				{!isReady && !error && <div className={styles.loadingOverlay}>Loading...</div>}
				{error && <div className={styles.errorOverlay}>{error}</div>}

				<div
					className={styles.canvasWrapper}
					style={{
						aspectRatio: `${stageSize.width} / ${stageSize.height}`,
						width: "100%",
						height: "100%",
						maxWidth: "100%",
						maxHeight: "100%",
					}}
				>
					<canvas
						ref={canvasRef}
						className={styles.animatorCanvas}
						width={stageSize.width}
						height={stageSize.height}
					/>
				</div>
			</div>
			<div className={styles.animatorControls}>
				<div className={styles.angleControl}>
					<div className={styles.angleButtons}>
						<button
							className={styles.angleButton}
							onClick={() => handleAngleChange(-1)}
							title="Rotate Left"
						>
							{"[<]"}
						</button>
						<button
							className={styles.angleButton}
							onClick={() => handleAngleChange(1)}
							title="Rotate Right"
						>
							{"[>]"}
						</button>
					</div>

					<div className={styles.stateControl} role="radiogroup" aria-label="Animation selection">
						{animations.map((anim) => (
							<Radio
								key={anim}
								label={anim}
								isSelected={anim === animName}
								onChange={() => setAnimName(anim)}
								name={`anim-selection-${uuid}`}
								value={anim}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
