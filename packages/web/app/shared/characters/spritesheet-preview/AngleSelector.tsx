import type { FC } from "react";
import styles from "./AngleSelector.module.css";

type AngleSelectorProps = {
	availableAngles: number[];
	currentAngle: number;
	onAngleChange: (angle: number) => void;
};

// Doom angle grid: [NW, N, NE] / [W, C, E] / [SW, S, SE]
const ANGLE_MAP = [
	[4, 5, 6],
	[3, 0, 7],
	[2, 1, 8],
];

export const AngleSelector: FC<AngleSelectorProps> = ({
	availableAngles,
	currentAngle,
	onAngleChange,
}) => {
	const showOnlyCenter = availableAngles.includes(0);

	return (
		<div className={styles.grid}>
			{ANGLE_MAP.flatMap((row) =>
				row.map((angle) => {
					const isVisible = showOnlyCenter ? angle === 0 : availableAngles.includes(angle);
					const isSelected = currentAngle === angle;

					if (!isVisible) {
						return <div key={angle} className={styles.empty} />;
					}

					return (
						<button
							key={angle}
							type="button"
							className={`${styles.cell} ${isSelected ? styles.selected : ""}`}
							onClick={() => onAngleChange(angle)}
							aria-label={`Angle ${angle}`}
							aria-pressed={isSelected}
						>
							{angle === 0 ? <span className={styles.centerDot} /> : angle}
						</button>
					);
				}),
			)}
		</div>
	);
};
