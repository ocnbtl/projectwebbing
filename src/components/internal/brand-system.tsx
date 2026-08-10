import { method, palette, promise, standards, unresolvedIdentity } from "@/lib/brand";
import { MotionSpecimen } from "./motion-specimen";
import styles from "./brand-system.module.css";

export function BrandSystem() {
  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>Living identity <span>{"\u00B7"}</span> v0.1</p>
          <h1>Brand system</h1>
        </div>
        <div className={styles.status}>
          <span />
          Building together
        </div>
      </header>

      <section className={styles.section} aria-labelledby="color-title">
        <div className={styles.sectionIntro}>
          <span>01</span>
          <div>
            <h2 id="color-title">Color</h2>
            <p>Source palette approved. Usage roles will keep evolving.</p>
          </div>
        </div>
        <div className={styles.palette}>
          {palette.map((color, index) => (
            <div
              className={styles.swatch}
              data-index={index}
              key={color.name}
              style={{ "--swatch": color.hex } as React.CSSProperties}
            >
              <span className={styles.colorField} />
              <div>
                <strong>{color.name}</strong>
                <span>{color.hex}</span>
                <small>{color.role}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="type-title">
        <div className={styles.sectionIntro}>
          <span>02</span>
          <div>
            <h2 id="type-title">Typography</h2>
            <p>Three voices. Each with one clear job.</p>
          </div>
        </div>
        <div className={styles.typeSpecimens}>
          <div className={styles.serifSpecimen}>
            <span>Instrument Serif / Editorial</span>
            <p>Made again.</p>
          </div>
          <div className={styles.sansSpecimen}>
            <span>Instrument Sans / Working language</span>
            <p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
            <p>abcdefghijklmnopqrstuvwxyz / 0123456789</p>
          </div>
          <div className={styles.plasterSpecimen}>
            <span>Plaster / Display only</span>
            <p>MADAGIN</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="verbal-title">
        <div className={styles.sectionIntro}>
          <span>03</span>
          <div>
            <h2 id="verbal-title">Verbal identity</h2>
            <p>What Madagin promises, how it works, and what the work must do.</p>
          </div>
        </div>
        <div className={styles.verbalGrid}>
          <div className={styles.promise}>
            <span>Promise</span>
            <p>{promise}</p>
          </div>
          <div>
            <span>Method</span>
            <ol>
              {method.map((step) => (
                <li key={step.name}>
                  <strong>{step.name}</strong>
                  <small>{step.description}</small>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <span>Standards</span>
            <ol>
              {standards.map((standard) => (
                <li key={standard.name}>
                  <strong>{standard.name}</strong>
                  <small>{standard.question}</small>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="motion-title">
        <div className={styles.sectionIntro}>
          <span>04</span>
          <div>
            <h2 id="motion-title">Motion</h2>
            <p>The name holds, gives under pressure, and returns to form.</p>
          </div>
        </div>
        <MotionSpecimen />
      </section>

      <section className={`${styles.section} ${styles.unresolved}`} aria-labelledby="unresolved-title">
        <div className={styles.sectionIntro}>
          <span>05</span>
          <div>
            <h2 id="unresolved-title">Next decisions</h2>
            <p>Open questions stay visibly open until they are approved.</p>
          </div>
        </div>
        <ol>
          {unresolvedIdentity.map((item, index) => (
            <li key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
              <small>Not approved</small>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
