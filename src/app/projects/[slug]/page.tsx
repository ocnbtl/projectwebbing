import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentDetail } from "@/components/public/public-pages";
import { getPublishedContentItem } from "@/lib/content";

export const dynamic = "force-dynamic";

type ProjectPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublishedContentItem("project", slug);
  if (!item) return {};
  const url = `/projects/${encodeURIComponent(item.slug)}`;
  const images = item.coverImageUrl ? [{ url: item.coverImageUrl, alt: `${item.title} website` }] : undefined;
  return {
    title: item.title,
    description: item.summary,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: "Madagin", title: `${item.title} · Madagin`, description: item.summary, url, images },
    twitter: { card: "summary_large_image", title: `${item.title} · Madagin`, description: item.summary, images },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const item = await getPublishedContentItem("project", slug);
  if (!item) notFound();
  return <ContentDetail item={item} />;
}
