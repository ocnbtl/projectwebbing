import Link from "next/link";
import styles from "./public-chrome.module.css";

const navigation = [
  { href: "/projects", label: "Work" },
  { href: "/about", label: "Studio" },
  { href: "/blog", label: "Notes" },
] as const;

export function MadaginMark({ compact = false }: { compact?: boolean }) {
  return <span className={compact ? styles.markCompact : styles.mark} aria-hidden="true">madagin</span>;
}

export function PublicHeader({ tone = "light", onDestination, activeDestination }: {
  tone?: "dark" | "light";
  onDestination?: (destination: "about" | "projects" | "blog") => void;
  activeDestination?: "about" | "projects" | "blog";
}) {
  return <header className={`${styles.header} ${styles[tone]}`}>
    <Link className={styles.logoLink} href="/" aria-label="Madagin home"><MadaginMark /></Link>
    <nav className={styles.navigation} aria-label="Primary navigation">{navigation.map(item => <Link href={item.href} key={item.href} aria-current={activeDestination === item.href.slice(1) ? "page" : undefined}
      onClick={onDestination ? event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault(); onDestination(item.href.slice(1) as "about" | "projects" | "blog");
      } : undefined}>{item.label}</Link>)}</nav>
    <Link className={styles.talkLink} href="/contact">Start a brief <span aria-hidden="true">↗</span></Link>
  </header>;
}

export function PublicFooter() {
  return <footer className={styles.footer}>
    <Link className={styles.footerMark} href="/" aria-label="Madagin home"><MadaginMark compact /></Link>
    <div className={styles.footerLine}><span>Independent by design.</span><span>© {new Date().getFullYear()} Madagin</span></div>
    <nav className={styles.footerNav} aria-label="Footer navigation">{navigation.map(item => <Link href={item.href} key={item.href}>{item.label}</Link>)}<Link href="/contact">Project brief</Link></nav>
  </footer>;
}
