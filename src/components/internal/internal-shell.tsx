import Link from "next/link";
import { logout } from "@/app/internal/login/actions";
import { InternalNav } from "./internal-nav";
import styles from "./internal-shell.module.css";

export function InternalShell({
  children,
  username,
}: {
  children: React.ReactNode;
  username: string;
}) {
  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#workspace-content">
        Skip workspace navigation
      </a>
      <aside className={styles.sidebar}>
        <Link className={styles.wordmark} href="/internal" aria-label="Madagin internal home">
          MADAGIN
        </Link>
        <InternalNav />
        <div className={styles.sidebarFoot}>
          <div className={styles.privateState}>
            <span>Private workspace</span>
            <small>{username}</small>
          </div>
          <Link className={styles.publicExit} href="/">
            Public site <span aria-hidden="true">{"\u2197"}</span>
          </Link>
          <form action={logout}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <div className={styles.mobileHeader}>
        <div className={styles.mobileTop}>
          <Link className={styles.wordmark} href="/internal">
            MADAGIN
          </Link>
          <div className={styles.mobileActions}>
            <Link href="/">Site <span aria-hidden="true">{"\u2197"}</span></Link>
            <form action={logout}>
              <button type="submit">Sign out</button>
            </form>
          </div>
        </div>
        <InternalNav />
      </div>
      <main id="workspace-content" className={styles.content}>
        {children}
      </main>
    </div>
  );
}
