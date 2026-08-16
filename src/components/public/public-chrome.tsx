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

export function PublicHeader({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const contactHref = process.env.NEXT_PUBLIC_MADAGIN_CONTACT_HREF || "/about#contact";
  return (
    <header className={`${styles.header} ${styles[tone]}`}>
      <Link className={styles.logoLink} href="/" aria-label="Madagin home">
        <MadaginMark />
      </Link>
      <nav className={styles.navigation} aria-label="Primary navigation">
        {navigation.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <a className={styles.talkLink} href={contactHref}>
        Let&apos;s Talk
      </a>
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
        <Link href="/internal">Admin</Link>
      </nav>
    </footer>
  );
}
