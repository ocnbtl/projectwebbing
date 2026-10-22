import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentDetail } from "@/components/public/public-pages";
import { getContentItems } from "@/lib/content";
import styles from "./review.module.css";

export const metadata: Metadata = { title: "Project story draft review", robots: { index: false, follow: false } };
const websites: Record<string, string> = {
  "sage-burress": "https://sageburress.com",
  "masonry-color-corrections": "https://masonrycolorcorrections.com",
};

export default async function ProjectStoriesReview({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const items = (await getContentItems({ kind: "project", includeDrafts: true }))
    .filter(item => websites[item.slug]);
  const requested = (await searchParams).project;
  const item = items.find(row => row.slug === requested) ?? (!requested ? items.find(row => row.slug === "sage-burress") : null);
  if (!item) notFound();
  return <>
    <aside className={styles.bar} aria-label="Local project draft review">
      <span>Local publication review</span>
      <nav aria-label="Project drafts">{items.map(row => <Link aria-current={row.id === item.id ? "page" : undefined} key={row.id} href={`/project-stories-review?project=${row.slug}`}>{row.title}</Link>)}</nav>
      <a href={websites[item.slug]} target="_blank" rel="noopener noreferrer">Visit the live client site ↗</a>
    </aside>
    <div className={styles.preview}><ContentDetail item={item} /></div>
  </>;
}
