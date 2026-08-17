"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  budgetOptions,
  currentSituationOptions,
  timingOptions,
  workNeedOptions,
} from "@/lib/inquiry-options";
import { MadaginMark } from "@/components/public/public-chrome";
import styles from "./contact-journey.module.css";

type Answers = {
  budget: string;
  company: string;
  context: string;
  currentSituation: string;
  email: string;
  name: string;
  needs: string[];
  timing: string;
};

const emptyAnswers: Answers = {
  budget: "",
  company: "",
  context: "",
  currentSituation: "",
  email: "",
  name: "",
  needs: [],
  timing: "",
};

function Arrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 20">
      <path d="M1 10h44M36 1l9 9-9 9" fill="none" stroke="currentColor" strokeLinecap="square" strokeWidth="2" />
    </svg>
  );
}

function ChoiceList({
  multiple = false,
  onChange,
  options,
  value,
}: {
  multiple?: boolean;
  onChange: (next: string | string[]) => void;
  options: readonly string[];
  value: string | string[];
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  return (
    <div className={styles.choices}>
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            aria-pressed={isSelected}
            className={isSelected ? styles.choiceSelected : undefined}
            key={option}
            onClick={() => {
              if (!multiple) return onChange(option);
              onChange(
                isSelected
                  ? selected.filter((item) => item !== option)
                  : [...selected, option],
              );
            }}
            type="button"
          >
            <span>{option}</span>
            <Arrow />
          </button>
        );
      })}
    </div>
  );
}

function SendButton() {
  return (
    <button aria-disabled="true" className={styles.sendButton} disabled type="button">
      <span>Send the project</span>
      <Arrow />
    </button>
  );
}

function contactIsValid(answers: Answers) {
  return (
    answers.name.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email.trim())
  );
}

export function ContactJourney() {
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reviewing = step === 6;
  const progress = reviewing ? 1 : step / 5;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const patchAnswers = (next: Partial<Answers>) => {
    setAnswers((current) => ({ ...current, ...next }));
  };
  const canContinue =
    (step === 0 && Boolean(answers.currentSituation)) ||
    (step === 1 && answers.needs.length > 0) ||
    (step === 2 && Boolean(answers.budget)) ||
    (step === 3 && Boolean(answers.timing)) ||
    (step === 4 && answers.context.trim().length >= 20) ||
    (step === 5 && contactIsValid(answers));

  const journeyStyle = { "--journey-progress": progress } as CSSProperties;

  return (
    <main className={styles.journey} style={journeyStyle}>
      <div className={styles.background} aria-hidden="true" />
      <a className="skip-link" href="#contact-question">Skip to the question</a>
      <header className={styles.chrome}>
        <Link href="/" aria-label="Madagin home"><MadaginMark /></Link>
        <Link href="/">Close</Link>
      </header>

      <form className={styles.form}>
        <div className={styles.progressText} aria-hidden="true">
          <span>{reviewing ? "06" : String(step + 1).padStart(2, "0")}</span> / 06
        </div>

        <section className={`${styles.questionPanel} ${reviewing ? styles.reviewPanel : ""}`} id="contact-question" key={step}>
          {step === 0 ? (
            <>
              <h1 ref={headingRef} tabIndex={-1}>Where are things now?</h1>
              <ChoiceList
                onChange={(value) => patchAnswers({ currentSituation: value as string })}
                options={currentSituationOptions}
                value={answers.currentSituation}
              />
            </>
          ) : null}
          {step === 1 ? (
            <>
              <h1 ref={headingRef} tabIndex={-1}>What needs to change?</h1>
              <p className={styles.questionNote}>Choose everything that belongs in the conversation.</p>
              <ChoiceList
                multiple
                onChange={(value) => patchAnswers({ needs: value as string[] })}
                options={workNeedOptions}
                value={answers.needs}
              />
            </>
          ) : null}
          {step === 2 ? (
            <>
              <h1 ref={headingRef} tabIndex={-1}>What range are you planning around?</h1>
              <ChoiceList
                onChange={(value) => patchAnswers({ budget: value as string })}
                options={budgetOptions}
                value={answers.budget}
              />
            </>
          ) : null}
          {step === 3 ? (
            <>
              <h1 ref={headingRef} tabIndex={-1}>When do you want to move?</h1>
              <ChoiceList
                onChange={(value) => patchAnswers({ timing: value as string })}
                options={timingOptions}
                value={answers.timing}
              />
            </>
          ) : null}
          {step === 4 ? (
            <>
              <h1 ref={headingRef} tabIndex={-1}>What should I understand?</h1>
              <p className={styles.questionNote}>The business, the project, the sticking point—whatever gives this shape.</p>
              <label className={styles.longAnswer}>
                <span>Project context</span>
                <textarea
                  autoFocus
                  maxLength={6_000}
                  onChange={(event) => patchAnswers({ context: event.target.value })}
                  placeholder="Tell me what changed, what isn’t working, and what you want the next version to make possible."
                  rows={7}
                  value={answers.context}
                />
                <small>{answers.context.length} / 6,000</small>
              </label>
            </>
          ) : null}
          {step === 5 ? (
            <>
              <h1 ref={headingRef} tabIndex={-1}>Who should I reply to?</h1>
              <div className={styles.contactFields}>
                <label>
                  <span>Name</span>
                  <input
                    autoComplete="name"
                    autoFocus
                    maxLength={120}
                    onChange={(event) => patchAnswers({ name: event.target.value })}
                    placeholder="Your name"
                    type="text"
                    value={answers.name}
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input
                    autoComplete="email"
                    inputMode="email"
                    maxLength={254}
                    onChange={(event) => patchAnswers({ email: event.target.value })}
                    placeholder="you@company.com"
                    type="email"
                    value={answers.email}
                  />
                </label>
                <label>
                  <span>Company <em>optional</em></span>
                  <input
                    autoComplete="organization"
                    maxLength={120}
                    onChange={(event) => patchAnswers({ company: event.target.value })}
                    placeholder="Company name"
                    type="text"
                    value={answers.company}
                  />
                </label>
              </div>
            </>
          ) : null}
          {reviewing ? (
            <>
              <h1 ref={headingRef} tabIndex={-1}>Ready when you are.</h1>
              <div className={styles.review}>
                {[
                  ["Where things are", answers.currentSituation, 0],
                  ["What needs to change", answers.needs.join(", "), 1],
                  ["Budget", answers.budget, 2],
                  ["Timing", answers.timing, 3],
                  ["Project context", answers.context, 4],
                  ["Reply to", `${answers.name} · ${answers.email}${answers.company ? ` · ${answers.company}` : ""}`, 5],
                ].map(([label, value, targetStep]) => (
                  <div className={styles.reviewRow} key={String(label)}>
                    <span>{label}</span>
                    <p>{value}</p>
                    <button onClick={() => setStep(Number(targetStep))} type="button">Edit</button>
                  </div>
                ))}
              </div>
              <div className={styles.sendArea}>
                <p>This is where your answers will go directly to Madagin once the new email is ready.</p>
                <SendButton />
                <small>Email delivery opens when Madagin&apos;s domain is live. For now, this final control is intentionally inactive.</small>
              </div>
            </>
          ) : null}
        </section>

        {!reviewing ? (
          <div
            aria-label={`Step ${step + 1} of 6`}
            aria-valuemax={6}
            aria-valuemin={1}
            aria-valuenow={step + 1}
            className={styles.contourProgress}
            role="progressbar"
          >
            <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 1000 56">
              <path className={styles.contourBase} d="M0 37 64 21 129 39 248 38 310 10 392 40 492 33 563 17 650 36 740 35 804 11 873 36 942 24 1000 31" pathLength="1" />
              <path className={styles.contourActive} d="M0 37 64 21 129 39 248 38 310 10 392 40 492 33 563 17 650 36 740 35 804 11 873 36 942 24 1000 31" pathLength="1" />
            </svg>
          </div>
        ) : null}

        {!reviewing ? (
          <div className={styles.stepControls}>
            <button disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} type="button">Back</button>
            <button
              className={styles.continueButton}
              disabled={!canContinue}
              onClick={() => setStep((current) => Math.min(6, current + 1))}
              type="button"
            >
              Continue <Arrow />
            </button>
          </div>
        ) : null}
      </form>
    </main>
  );
}
