import type { FC } from "react";
import { AngleSelector } from "./AngleSelector";
import { CornerLeftUp, CornerRightUp } from "./icons";
import styles from "./PreviewControls.module.css";
import { Button } from "~/shared/ui/button";
import { Select } from "~/shared/ui/select";
import { Radio } from "~/shared/ui/radio";

type PreviewControlsProps = {
	animations: string[];
	currentAnimation: string;
	availableAngles: number[];
	currentAngle: number;
	onAnimationChange: (animation: string) => void;
	onAngleChange: (angle: number) => void;
};

export const PreviewControls: FC<PreviewControlsProps> = ({
	animations,
	currentAnimation,
	availableAngles,
	currentAngle,
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
		return availableAngles[(idx - 1 + availableAngles.length) % availableAngles.length];
	};

	return (
		<div className={styles.controlsContainer}>
			<div className={styles.controlsMini}>
				<Button
					ariaLabel="Next angle"
					onClick={() => onAngleChange(getNextAngle())}
					iconLeft={<CornerLeftUp width={24} height={24} />}
					isDisabled={availableAngles.length <= 1}
				/>

				<Select
					onChange={onAnimationChange}
					options={animations.map((animation) => ({ value: animation }))}
					value={currentAnimation}
				/>

				<Button
					ariaLabel="Previous angle"
					onClick={() => onAngleChange(getPrevAngle())}
					iconLeft={<CornerRightUp width={24} height={24} />}
					isDisabled={availableAngles.length <= 1}
				/>
			</div>
			<div className={styles.controlsFull}>
				<div className={styles.sectionLabel}>Animation</div>
				{animations.map((anim) => {
					const isSelected = anim === currentAnimation;
					return (
						<Radio
							isSelected={isSelected}
							key={anim}
							label={anim}
							value={anim}
							onChange={() => onAnimationChange(anim)}
							name={anim}
						/>
					);
				})}

				<div className={styles.angleLabel}>Angle</div>
				<div className={styles.angleSection}>
					<AngleSelector
						availableAngles={availableAngles}
						currentAngle={currentAngle}
						onAngleChange={onAngleChange}
					/>
				</div>
			</div>
		</div>
	);
};
