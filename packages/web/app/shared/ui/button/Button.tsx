import { ReactElement } from "react";
import styles from "./Button.module.css";

type ButtonProps = {
	onClick: () => void;
	ariaLabel: string;
	isDisabled?: boolean;
	text?: string;
	iconLeft?: ReactElement;
	iconRight?: ReactElement;
};

/** Button component */
export function Button({ onClick, isDisabled, iconLeft, iconRight, text, ariaLabel }: ButtonProps) {
	return (
		<button
			type="button"
			className={styles.btn}
			onClick={onClick}
			disabled={isDisabled}
			aria-label={ariaLabel}
		>
			{iconLeft}
			{text}
			{iconRight}
		</button>
	);
}
