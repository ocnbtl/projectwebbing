"use client";

import dynamic from "next/dynamic";
import styles from "./world-lab.module.css";

const WorldLab = dynamic(
  () => import("./world-lab").then((module) => module.WorldLab),
  {
    ssr: false,
    loading: () => (
      <div className={styles.loading} role="status">
        <span />
        Loading the real-time world lab…
      </div>
    ),
  },
);

export function WorldLabLoader() {
  return <WorldLab />;
}
