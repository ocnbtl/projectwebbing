import Link from "next/link";
import styles from "./public-chrome.module.css";

const navigation = [
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
] as const;

export function MadaginMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? styles.markCompact : styles.mark} aria-hidden="true">
      M
    </span>
  );
}

export function PublicHeader({ tone = "dark", onDestination, activeDestination }: {
  tone?: "dark" | "light";
  onDestination?: (destination: "about" | "projects" | "blog") => void;
  activeDestination?: "about" | "projects" | "blog";
}) {
  return (
    <header className={`${styles.header} ${styles[tone]}`}>
      <Link className={styles.logoLink} href="/" aria-label="Madagin home">
        <MadaginMark />
      </Link>
      <nav className={styles.navigation} aria-label="Primary navigation">
        {navigation.map((item) => (
          <Link href={item.href} key={item.href} aria-current={activeDestination === item.href.slice(1) ? "location" : undefined}
            onClick={onDestination ? event => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
              event.preventDefault();
              onDestination(item.href.slice(1) as "about" | "projects" | "blog");
            } : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>
      <Link className={styles.talkLink} href="/contact">
        Let&apos;s Talk
      </Link>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <Link className={styles.footerMark} href="/" aria-label="Madagin home">
        <MadaginMark compact />
      </Link>
      <div className={styles.footerLine}>
        <span>Strategy, design, and development.</span>
        <span>{"\u00A9"} {new Date().getFullYear()} Madagin</span>
      </div>
      <nav className={styles.footerNav} aria-label="Footer navigation">
        {navigation.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
        <Link href="/contact">Let&apos;s Talk</Link>
        <Link href="/internal">Admin</Link>
      </nav>
    </footer>
  );
}
