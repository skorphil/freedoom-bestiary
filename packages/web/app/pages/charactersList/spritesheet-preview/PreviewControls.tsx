import type { FC } from "react";
import { AngleSelector } from "./AngleSelector";
import {
	Checkbox,
	CheckboxOn,
	ChevronDown2,
	CornerLeftUp,
	CornerRightUp,
} from "./icons";
import styles from "./PreviewControls.module.css";

type PreviewControlsProps = {
	animations: string[];
	currentAnimation: string;
	availableAngles: number[];
	currentAngle: number;
	variant?: "sm";
	onAnimationChange: (animation: string) => void;
	onAngleChange: (angle: number) => void;
};

export const PreviewControls: FC<PreviewControlsProps> = ({
	animations,
	currentAnimation,
	availableAngles,
	currentAngle,
	variant,
	onAnimationChange,
	onAngleChange,
}) => {
	const getNextAngle = () => {
		const idx = availableAngles.indexOf(currentAngle);
		if (idx === -1 || availableAngles.length <= 1) return currentAngle;
		return availableAngles[(idx + 1) % availableAngles.length];
	};

	const getPrevAngle = () => {
		const idx = availableAngles.indexOf(currentAngle);
		if (idx === -1 || availableAngles.length <= 1) return currentAngle;
		return availableAngles[
			(idx - 1 + availableAngles.length) % availableAngles.length
		];
	};

	switch (variant) {
		case "sm":
			return (
				<div className={styles.mobileBar}>
					<button
						type="button"
						className={styles.iconBtn}
						onClick={() => onAngleChange(getNextAngle())}
						disabled={availableAngles.length <= 1}
						aria-label="Previous angle"
					>
						<CornerLeftUp width={24} height={24} />
					</button>

					<div className={styles.animSelect}>
						<ChevronDown2
							width={24}
							height={24}
							className={styles.selectChevron}
						/>
						<select
							className={styles.selectNative}
							value={currentAnimation}
							onChange={(e) => onAnimationChange(e.target.value)}
						>
							{animations.map((anim) => (
								<option key={anim} value={anim}>
									{anim}
								</option>
							))}
						</select>
					</div>

					<button
						type="button"
						className={styles.iconBtn}
						onClick={() => onAngleChange(getPrevAngle())}
						disabled={availableAngles.length <= 1}
						aria-label="Next angle"
					>
						<CornerRightUp width={24} height={24} />
					</button>
				</div>
			);

		default: {
			return (
				<div className={styles.desktopControls}>
					<div className={styles.animSection}>
						<span className={styles.sectionLabel}>Animation</span>
						<div className={styles.animList}>
							{animations.map((anim) => {
								const isSelected = anim === currentAnimation;
								return (
									<button
										key={anim}
										type="button"
										className={`${styles.checkboxItem} ${isSelected ? styles.selected : ""}`}
										onClick={() => onAnimationChange(anim)}
									>
										<span className={styles.animName}>{anim}</span>
										{isSelected ? (
											<CheckboxOn
												width={20}
												height={20}
												className={styles.checkIcon}
											/>
										) : (
											<Checkbox
												width={20}
												height={20}
												className={styles.checkIcon}
											/>
										)}
									</button>
								);
							})}
						</div>
					</div>

					<div className={styles.angleSection}>
						<span className={styles.sectionLabel}>Angle</span>
						<AngleSelector
							availableAngles={availableAngles}
							currentAngle={currentAngle}
							onAngleChange={onAngleChange}
						/>
					</div>
				</div>
			);
		}
	}
};
