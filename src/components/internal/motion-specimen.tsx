"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import styles from "./brand-system.module.css";

export function MotionSpecimen() {
  const [replay, setReplay] = useState(0);
  const reducedMotion = useReducedMotion();

  return (
    <div className={styles.motionDemo}>
      <div className={styles.motionStage} aria-label="Madagin vertical drag motion specimen">
        <motion.span
          key={replay}
          initial={{ scaleY: 1, y: 0 }}
          animate={
            reducedMotion
              ? { opacity: [0.65, 1] }
              : {
                  scaleY: [1, 1, 3.1, 1.08, 1],
                  y: [0, 0, 48, 0, 0],
                }
          }
          transition={{
            duration: reducedMotion ? 0.18 : 1.15,
            times: reducedMotion ? [0, 1] : [0, 0.22, 0.49, 0.72, 1],
            ease: [0.77, 0, 0.175, 1],
          }}
        >
          MADAGIN
        </motion.span>
      </div>
      <div className={styles.motionControls}>
        <p>{"Rest \u2192 drag down \u2192 stretch \u2192 resettle"}</p>
        <button type="button" onClick={() => setReplay((value) => value + 1)}>
          Replay motion
        </button>
      </div>
    </div>
  );
}
