import { Outlet } from "react-router";
import { Header } from "~/src/components/Header";
import styles from "./layout.module.css";

/** Main website Layout */
function layout() {
	return (
		<>
			<Header />
			<main className={styles.contentArea}>
				<Outlet />
			</main>
		</>
	);
}

export default layout;
