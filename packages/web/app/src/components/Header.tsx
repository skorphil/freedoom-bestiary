import styles from "./Header.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.title}>FreeDoom Bestiary</div>
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
