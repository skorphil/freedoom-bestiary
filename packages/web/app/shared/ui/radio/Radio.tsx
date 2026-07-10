import { useId } from "react";
import { Checkbox } from "pixelarticons/react/Checkbox";
import { CheckboxOn } from "pixelarticons/react/CheckboxOn";
import styles from "./Radio.module.css";

type RadioProps = {
	label: string;
	isSelected: boolean;
	onChange: () => void;
	name: string;
	value: string;
};

/** Accessible Radio-button element styled as a Checkbox */
export function Radio({ label, isSelected, onChange, name, value }: RadioProps) {
	const id = useId();

	return (
		<div className={styles.checkboxWrapper}>
			<input
				type="radio"
				id={id}
				name={name}
				value={value}
				checked={isSelected}
				onChange={onChange}
				className={styles.hiddenInput}
			/>
			<label htmlFor={id} className={styles.checkboxItem}>
				<span className={styles.label}>{label}</span>
				{isSelected ? (
					<CheckboxOn width={20} height={20} className={styles.checkIcon} />
				) : (
					<Checkbox width={20} height={20} className={styles.checkIcon} />
				)}
			</label>
		</div>
	);
}
