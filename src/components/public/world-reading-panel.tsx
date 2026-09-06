"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { method, promise, standards, studioIntroduction } from "@/lib/brand";
import type { ContentItem } from "@/lib/content-types";
import type { ReadingDestination } from "@/lib/world-reading-location";
import styles from "./world-reading-panel.module.css";

export function WorldReadingPanel({ destination, slug, projects, posts, onReturn, onSelect, scrollPositions }: {
  destination: ReadingDestination;
  slug?: string;
  projects: ContentItem[];
  posts: ContentItem[];
  onReturn: () => void;
  onSelect: (slug?: string) => void;
  scrollPositions: RefObject<Map<string, number>>;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const items = (destination === "projects" ? projects : posts).filter(item => item.status === "published");
  const selected = items.find(item => item.slug === slug);
  const readingKey = `${destination}/${slug ?? ""}`;
  const title = selected?.title ?? { about: "A fresh perspective.", projects: "Selected projects.", blog: "From the desk." }[destination];

  useLayoutEffect(() => {
    const region = scroll.current;
    const positions = scrollPositions.current;
    region?.scrollTo({ top: positions.get(readingKey) ?? 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [readingKey, scrollPositions]);

  return (
    <section className={styles.panel} data-world-content={destination} aria-labelledby="world-reading-title"
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onReturn(); } }}>
      <div className={styles.topline}>
        <span>{destination === "about" ? "01 / Ocean · About" : destination === "projects" ? "02 / Sky · Projects" : "03 / Hillside · Blog"}</span>
        <button type="button" onClick={onReturn} aria-label="Return to journey">Close ×</button>
      </div>
      <div ref={scroll} className={styles.scroll} tabIndex={0} role="region" aria-label={`${destination} reading area`}
        onScroll={event => scrollPositions.current.set(readingKey, event.currentTarget.scrollTop)}>
        {selected ? <button className={styles.back} type="button" onClick={() => onSelect()}>← All {destination}</button> : null}
        <h2 ref={heading} id="world-reading-title" tabIndex={-1}>{title}</h2>
        {destination === "about" ? <>
          <p className={styles.lead}>{promise}</p>
          <p>{studioIntroduction}</p>
          <h3>How we work</h3>
          <ol className={styles.method}>{method.map(step => <li key={step.name}><h4>{step.name}</h4><p>{step.description}</p></li>)}</ol>
          <h3>What the site has to become</h3>
          {standards.map(standard => <div key={standard.name}><h4>{standard.name}</h4><p>{standard.question}</p></div>)}
          <Link className={styles.cta} href="/contact">Start a conversation ↗</Link>
        </> : selected ? <article>
          <p className={styles.lead}>{selected.summary}</p>
          {selected.coverImageUrl ? <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.cover} src={selected.coverImageUrl} alt={`${selected.title} website preview`} />
          </> : null}
          {selected.body.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          <Link className={styles.cta} href={`/${destination}/${selected.slug}`}>Open the full {destination === "projects" ? "project" : "article"} page ↗</Link>
          {destination === "blog" ? <Link className={styles.cta} href="/contact">Prepare your project brief ↗</Link> : null}
          {items.length > 1 ? <button className={styles.next} type="button" onClick={() => onSelect(items[(items.findIndex(item => item.id === selected.id) + 1) % items.length].slug)}>Next: {items[(items.findIndex(item => item.id === selected.id) + 1) % items.length].title} →</button> : null}
        </article> : items.length ? <div className={styles.items}>
          <p className={styles.lead}>{destination === "projects" ? "Explore the work, without leaving the view." : "Notes on the decisions behind the work."}</p>
          {items.map(item => <Link className={styles.item} href={`/${destination}/${item.slug}`} onClick={event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault(); onSelect(item.slug);
          }} key={item.id}>
            {item.coverImageUrl ? <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.coverImageUrl} alt="" loading="lazy" />
            </> : null}
            <span><small>{item.details}</small><strong>{item.title} <span aria-hidden="true">↗</span></strong><span>{item.summary}</span></span>
          </Link>)}
        </div> : <><p className={styles.lead}>The first {destination === "blog" ? "notes are" : "project stories are"} taking shape.</p><p>{destination === "blog" ? "There are no published articles yet. In the meantime, explore the work or tell us what you’re working on." : "Published work will appear here when it is ready."}</p><Link className={styles.cta} href="/contact">Start a conversation ↗</Link></>}
      </div>
      <footer className={styles.footer}><span>Take your time. The view is yours.</span><Link href={`/${destination}`}>Open {destination} page ↗</Link></footer>
    </section>
  );
}
