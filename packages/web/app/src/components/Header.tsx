import { Link } from "react-router";
import styles from "./Header.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.title}>FreeDoom Bestiary</Link>
      <nav>
        <a href="https://freedoom.github.io" className={styles.link}>
          FreeDoom
        </a>
        <span>{" · "}</span>
        <a href="https://github.com/skorphil/freedoom-bestiary" className={styles.link}>
          Bestiary GitHub
        </a>
      </nav>
    </header>
  );
}
