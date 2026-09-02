"use client";

import type { MotionValue } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import styles from "./public-world-loader.module.css";

const PublicWorldExperience = dynamic(
  () => import("@/components/internal/world-lab").then((module) => module.PublicWorldExperience),
  {
    ssr: false,
    loading: () => <div aria-hidden="true" className={styles.visualFallback} />,
  },
);

type NavigatorWithCapabilityHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

type Eligibility =
  | { live: true; reason: "supported" }
  | { live: false; reason: "checking" | "data-saver" | "low-power" | "reduced-motion" | "webgl-unavailable" };

function inspectEligibility(motionOff: boolean): Eligibility {
  if (motionOff) return { live: false, reason: "reduced-motion" };
  const navigatorWithHints = navigator as NavigatorWithCapabilityHints;
  if (navigatorWithHints.connection?.saveData) return { live: false, reason: "data-saver" };

  const memory = navigatorWithHints.deviceMemory;
  const cores = navigator.hardwareConcurrency || 1;
  if (memory !== undefined && memory <= 4 && cores <= 4) {
    return { live: false, reason: "low-power" };
  }

  const probe = document.createElement("canvas");
  const webgl2 = probe.getContext("webgl2", { powerPreference: "high-performance" });
  if (!webgl2) return { live: false, reason: "webgl-unavailable" };
  webgl2.getExtension("WEBGL_lose_context")?.loseContext();
  return { live: true, reason: "supported" };
}

export function PublicWorldLoader({
  motionOff,
  progress,
}: {
  motionOff: boolean;
  progress: MotionValue<number>;
}) {
  const [eligibility, setEligibility] = useState<Eligibility>({ live: false, reason: "checking" });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setEligibility(inspectEligibility(motionOff));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [motionOff]);

  return (
    <div className={styles.shell} data-public-world-loader={eligibility.reason}>
      {eligibility.live ? (
        <PublicWorldExperience className={styles.renderer} progress={progress} />
      ) : (
        <div aria-hidden="true" className={styles.visualFallback} />
      )}
      <p className={styles.status} role="status">
        {eligibility.live
          ? "The live Madagin mountain world is active."
          : eligibility.reason === "checking"
            ? "Checking whether this device can run the live Madagin mountain world."
            : "A still mountain composition is active for this device or motion preference."}
      </p>
    </div>
  );
}
