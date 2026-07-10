import { ChevronDown2 } from "pixelarticons/react/ChevronDown2";
import styles from "./Select.module.css";

type SelectProps = {
	options: Array<{ name?: string; value: string }>;
	value: string;
	onChange: (value: string) => void;
};

export function Select({ options, value, onChange }: SelectProps) {
	return (
		<div className={styles.animSelect}>
			<div className={styles.chevronWrapper}>
				<ChevronDown2 width={24} height={24} className={styles.selectChevron} />
			</div>
			<select
				className={styles.selectNative}
				value={value}
				onChange={(e) => onChange(e.target.value)}
			>
				{options.map(({ name, value }) => (
					<option key={value} value={value}>
						{name ? name : value}
					</option>
				))}
			</select>
		</div>
	);
}
