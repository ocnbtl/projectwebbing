"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./internal-shell.module.css";

const items = [
  { href: "/internal", label: "Analytics" },
  { href: "/internal/projects", label: "Projects" },
  { href: "/internal/blog", label: "Blog" },
  { href: "/internal/brand", label: "Brand system" },
];

export function InternalNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Private workspace">
      {items.map((item) => {
        const active =
          item.href === "/internal"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={active ? styles.active : undefined}
            href={item.href}
            key={item.href}
          >
            <span className={styles.navMark} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
