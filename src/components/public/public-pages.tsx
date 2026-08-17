import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public/public-chrome";
import { method, promise, standards } from "@/lib/brand";
import type { ContentItem, ContentKind } from "@/lib/content-types";
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
              <div className={styles.indexVisual}>
                {item.coverImageUrl ? (
                  // Publishing accepts committed /media paths and public HTTPS images.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={item.coverImageUrl} />
                ) : (
                  <div aria-hidden="true" />
                )}
              </div>
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

export function ContentDetail({ item }: { item: ContentItem }) {
  const projects = item.kind === "project";
  const route = routeFor(item.kind);
  const paragraphs = item.body.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);

  return (
    <PublicFrame>
      <article>
        <header className={styles.detailHero}>
          <Link href={`/${route}`}>Back to {projects ? "projects" : "the blog"}</Link>
          <span>{item.details || formatDate(item.publishedOn)}</span>
          <h1>{item.title}</h1>
          <p>{item.summary}</p>
        </header>
        {item.coverImageUrl ? (
          // Publishing accepts committed /media paths and public HTTPS images.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.detailImage} alt="" src={item.coverImageUrl} />
        ) : (
          <div className={styles.detailTerrain} aria-hidden="true" />
        )}
        <div className={styles.detailBody}>
          <span>{projects ? "Project story" : "Madagin note"}</span>
          <div>{paragraphs.map((paragraph, index) => <p key={`${item.id}-${index}`}>{paragraph}</p>)}</div>
        </div>
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
        <p>
          Madagin is a founder-led web studio for businesses that have outgrown the way they show up online.
          Strategy, design, and development stay in one conversation from the first question to the finished site.
        </p>
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
