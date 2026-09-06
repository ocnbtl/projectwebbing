import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public/public-chrome";
import { method, promise, standards, studioIntroduction } from "@/lib/brand";
import { getProjectPresentation } from "@/content/project-presentations";
import type { ContentItem, ContentKind } from "@/lib/content-types";
import { getPublishedContentItem } from "@/lib/content";
import styles from "./public-pages.module.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function routeFor(kind: ContentKind) {
  return kind === "project" ? "projects" : "blog";
}

function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#page-content">Skip to content</a>
      <PublicHeader tone="light" />
      <main id="page-content">{children}</main>
      <PublicFooter />
    </>
  );
}

export function ContentIndex({
  kind,
  items,
}: {
  kind: ContentKind;
  items: ContentItem[];
}) {
  const projects = kind === "project";
  const route = routeFor(kind);

  return (
    <PublicFrame>
      <header className={styles.indexHero}>
        <span>Madagin / {projects ? "Projects" : "Blog"}</span>
        <h1>{projects ? "Sites people remember." : "A look behind the work."}</h1>
        <p>
          {projects
            ? "Selected website work, the decisions behind it, and what changed."
            : "Notes on perspective, design, and building a more distinctive presence online."}
        </p>
      </header>

      <section className={styles.indexList} aria-label={projects ? "Projects" : "Blog posts"}>
        {items.length ? (
          items.map((item, index) => (
            <article className={styles.indexItem} key={item.id}>
              <span className={styles.itemNumber}>{String(index + 1).padStart(2, "0")}</span>
              <Link className={`${styles.indexVisual} ${projects ? styles.projectVisual : ""}`} href={`/${route}/${item.slug}`} aria-label={`View ${item.title}`}>
                {item.coverImageUrl ? (
                  // Publishing accepts committed /media paths and public HTTPS images.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={item.coverImageUrl} loading="lazy" />
                ) : (
                  <div aria-hidden="true" />
                )}
              </Link>
              <div className={styles.indexCopy}>
                <span>{item.details || formatDate(item.publishedOn)}</span>
                <h2>
                  <Link href={`/${route}/${item.slug}`}>{item.title}</Link>
                </h2>
                <p>{item.summary}</p>
              </div>
            </article>
          ))
        ) : (
          <div className={styles.emptyIndex}>
            <div aria-hidden="true" />
            <p>{projects ? "The first project stories are being prepared." : "The first notes are still on the desk."}</p>
          </div>
        )}
      </section>
    </PublicFrame>
  );
}

export async function ContentDetail({ item }: { item: ContentItem }) {
  const projects = item.kind === "project";
  const route = routeFor(item.kind);
  const paragraphs = item.body.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const presentation = projects ? getProjectPresentation(item.slug) : null;
  const nextProject = presentation ? await getPublishedContentItem("project", presentation.next.slug) : null;

  return (
    <PublicFrame>
      <article className={presentation ? styles.projectStory : undefined}>
        <header className={styles.detailHero}>
          <Link href={`/${route}`}>Back to {projects ? "projects" : "the blog"}</Link>
          <span>{item.details || formatDate(item.publishedOn)}</span>
          <h1>{item.title}</h1>
          <p>{item.summary}</p>
          {presentation ? <a className={styles.liveWebsite} href={presentation.website} target="_blank" rel="noopener noreferrer">Visit {presentation.domain} <span aria-hidden="true">↗</span></a> : null}
        </header>
        {item.coverImageUrl ? (
          // Publishing accepts committed /media paths and public HTTPS images.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.detailImage} alt={presentation ? `${item.title} website, desktop opening.` : ""} src={item.coverImageUrl} />
        ) : (
          <div className={styles.detailTerrain} aria-hidden="true" />
        )}
        <div className={styles.detailBody}>
          <span>{projects ? "Project story" : "Madagin note"}</span>
          <div>{(presentation ? paragraphs.slice(0, 1) : paragraphs).map((paragraph, index) => <p key={`${item.id}-${index}`}>{paragraph}</p>)}</div>
        </div>
        {presentation ? <>
          <section className={styles.proofSection} aria-labelledby={`${item.slug}-detail`}>
            <div className={styles.proofCopy}>
              <span>01 / The work on screen</span>
              <h2 id={`${item.slug}-detail`}>{presentation.detailTitle}</h2>
              {paragraphs.slice(1).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/media/projects/proof-20260905/${item.slug}-detail.jpg`} width={1440} height={1000} alt={presentation.detailAlt} loading="lazy" />
              <figcaption>{presentation.detailCaption}</figcaption>
            </figure>
          </section>
          <section className={`${styles.proofSection} ${styles.mobileProof}`} aria-labelledby={`${item.slug}-mobile`}>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/media/projects/proof-20260905/${item.slug}-mobile.jpg`} width={390} height={844} alt={`${item.title} website opening at a mobile viewport.`} loading="lazy" />
              <figcaption>Website views captured September 2026.</figcaption>
            </figure>
            <div className={styles.proofCopy}>
              <span>02 / On a smaller screen</span>
              <h2 id={`${item.slug}-mobile`}>{presentation.mobileTitle}</h2>
              <p>{presentation.mobileCopy}</p>
              <a className={styles.liveWebsite} href={presentation.website} target="_blank" rel="noopener noreferrer">Explore the live website <span aria-hidden="true">↗</span></a>
            </div>
          </section>
          <section className={styles.projectClosing} aria-labelledby="project-next-step">
            <div><span>Your next website</span><h2 id="project-next-step">What needs to change?</h2><p>Tell me where the business is now, and what the website needs to do next.</p><Link href="/contact">Start a project brief <span aria-hidden="true">↗</span></Link></div>
            {nextProject ? <Link className={styles.nextProject} href={`/projects/${nextProject.slug}`}><span>Another project</span><strong>{nextProject.title}</strong><span aria-hidden="true">→</span></Link> : null}
          </section>
        </> : <section className={styles.projectClosing} aria-labelledby="note-next-step">
          <div><span>Your next website</span><h2 id="note-next-step">Start with what needs to change.</h2><p>Use the project brief to put the first questions in one place.</p><Link href="/contact">Prepare your project brief <span aria-hidden="true">→</span></Link></div>
        </section>}
      </article>
    </PublicFrame>
  );
}

export function AboutPage() {
  return (
    <PublicFrame>
      <header className={styles.aboutHero}>
        <span>Madagin / About</span>
        <h1>A fresh perspective for what comes next.</h1>
        <p>{promise}</p>
      </header>

      <section className={styles.aboutStatement}>
        <p>{studioIntroduction}</p>
      </section>

      <section className={styles.aboutMethod} aria-labelledby="about-method-title">
        <div className={styles.aboutLabel}>
          <h2 id="about-method-title">The work</h2>
        </div>
        <div>
          {method.map((step, index) => (
            <article key={step.name}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.name}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.aboutStandards} aria-labelledby="standards-title">
        <h2 id="standards-title">What the site has to become</h2>
        <div>
          {standards.map((standard) => (
            <article key={standard.name}>
              <h3>{standard.name}</h3>
              <p>{standard.question}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.contact} id="contact" aria-labelledby="contact-title">
        <h2 id="contact-title">Let&apos;s talk.</h2>
        <div>
          <p>If the business has moved forward and the website hasn&apos;t, tell me what changed.</p>
          <Link href="/contact">Start a conversation</Link>
        </div>
      </section>
    </PublicFrame>
  );
}
