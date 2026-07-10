import { useEffect, useState } from "react";
import Typewriter from "typewriter-effect";
import styles from "./home.module.css";

export function meta() {
	return [
		{ title: "Freedoom Bestiary" },
		{ name: "description", content: "Sprites gallery from FreeDoom" },
	];
}

export default function Home() {
	const [isHydrated, setIsHydrated] = useState(false);

	useEffect(() => {
		setIsHydrated(true);
	}, []);

	if (!isHydrated) {
		return (
			<div>
				<h1 className={styles.mainHeader}>Welcome</h1>
				<p>Bestiary database loaded</p>
			</div>
		);
	}

	return (
		<div>
			<h1 className={styles.mainHeader}>
				<Typewriter
					onInit={(typewriter) => {
						typewriter
							.typeString("Welcome")
							.callFunction((state) => {
								if (state.elements.cursor) {
									state.elements.cursor.style.display = "none";
								}
							})
							.start();
					}}
					options={{
						autoStart: true,
						loop: false,
						cursor: "_",
						delay: 10,
					}}
				/>
			</h1>
			<p>
				<Typewriter
					onInit={(typewriter) => {
						typewriter
							.callFunction((state) => {
								if (state.elements.cursor) {
									state.elements.cursor.style.display = "none";
								}
							})
							.pauseFor(1000)
							.callFunction((state) => {
								if (state.elements.cursor) {
									state.elements.cursor.style.display = "inline-block";
								}
							})
							.typeString("Bestiary database loaded")

							.start();
					}}
					options={{
						autoStart: true,
						loop: false,
						cursor: "_",
						delay: 10,
					}}
				/>
			</p>
		</div>
	);
}
