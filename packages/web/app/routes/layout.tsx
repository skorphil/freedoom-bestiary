import { Outlet } from "react-router";
import { Header } from "~/src/components/Header";
import styles from "./layout.module.css";

/** Main website Layout */
export default function Layout() {
	return (
		<>
			<Header />
			<main className={styles.contentArea}>
				<Outlet />
			</main>
		</>
	);
}
