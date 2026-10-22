import Link from "next/link";
import { BrandName } from "./brand-wordmark";
import {TablerIcon} from "@/components/ui/tabler-icon";
import { PublicFooter, PublicHeader } from "@/components/public/public-chrome";
import { ProjectShowcase } from "./project-showcase";
import {StudioAbout} from "./studio-about";
import {IsitusaIdentity} from "./isitusa-identity";

import { projectCapture } from "@/content/portfolio-assets";
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

function PublicFrame({ children, activeDestination }: { children: React.ReactNode;activeDestination?:"projects"|"about"|"blog" }) {
  return (
    <div className={styles.publicFrame}>
      <a className="skip-link" href="#page-content">Skip to content</a>
      <PublicHeader tone="dark" activeDestination={activeDestination}/>
      <main id="page-content">{children}</main>
      <PublicFooter />
    </div>
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
        <span><BrandName /> / {projects ? "Projects" : "Blog"}</span>
        <h1>{projects ? "Work with a point of view." : "From the studio."}</h1>
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
          <h1>{item.slug==='isitusa'?<IsitusaIdentity full/>:item.title}</h1>
          <p>{item.summary}</p>
          {presentation ? <a className={styles.liveWebsite} href={presentation.website} target="_blank" rel="noopener noreferrer">Visit {presentation.domain} <span aria-hidden="true"><TablerIcon name="arrow-up-right" size={18}/></span></a> : null}
        </header>
        {item.coverImageUrl ? (
          // Publishing accepts committed /media paths and public HTTPS images.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.detailImage} alt={presentation ? `${item.title} website, desktop opening.` : ""} src={item.coverImageUrl} />
        ) : (
          null
        )}
        <div className={styles.detailBody}>
          <span>{projects ? "Project story" : <><BrandName /> note</>}</span>
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
              <img src={projectCapture(item.slug, "detail")} width={1440} height={1000} alt={presentation.detailAlt} loading="lazy" />
              <figcaption>{presentation.detailCaption}</figcaption>
            </figure>
          </section>
          <section className={`${styles.proofSection} ${styles.mobileProof}`} aria-labelledby={`${item.slug}-mobile`}>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={projectCapture(item.slug, "mobile")} width={390} height={844} alt={`${item.title} website opening at a mobile viewport.`} loading="lazy" />
              <figcaption>Website views captured October 16, 2026.</figcaption>
            </figure>
            <div className={styles.proofCopy}>
              <span>02 / On a smaller screen</span>
              <h2 id={`${item.slug}-mobile`}>{presentation.mobileTitle}</h2>
              <p>{presentation.mobileCopy}</p>
              <a className={styles.liveWebsite} href={presentation.website} target="_blank" rel="noopener noreferrer">Explore the live website <span aria-hidden="true"><TablerIcon name="arrow-up-right" size={18}/></span></a>
            </div>
          </section>
          <section className={styles.projectClosing} aria-labelledby="project-next-step">
            <div><span>Your next website</span><h2 id="project-next-step">What needs to change?</h2><p>Tell me where the business is now, and what the website needs to do next.</p><Link href="/contact">Start a project brief <span aria-hidden="true"><TablerIcon name="arrow-up-right" size={18}/></span></Link></div>
            {nextProject ? <Link className={styles.nextProject} href={`/projects/${nextProject.slug}`}><span>Another project</span><strong>{nextProject.title}</strong><span aria-hidden="true"><TablerIcon name="arrow-right" size={28}/></span></Link> : null}
          </section>
        </> : <section className={styles.projectClosing} aria-labelledby="note-next-step">
          <div><span>Your next website</span><h2 id="note-next-step">Start with what needs to change.</h2><p>Use the project brief to put the first questions in one place.</p><Link href="/contact">Prepare your project brief <span aria-hidden="true"><TablerIcon name="arrow-right" size={18}/></span></Link></div>
        </section>}
      </article>
    </PublicFrame>
  );
}

export function WorkPage({items}:{items:ContentItem[]}) {
 return <PublicFrame activeDestination="projects"><h1 className="sr-only">Work by Madagin</h1><ProjectShowcase projects={items.map(item=>({...item,hasViews:!!getProjectPresentation(item.slug)}))}/></PublicFrame>;
}
export function AboutPage(){return <PublicFrame activeDestination="about"><StudioAbout/></PublicFrame>;}
