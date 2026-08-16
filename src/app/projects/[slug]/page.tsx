import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentDetail } from "@/components/public/public-pages";
import { getPublishedContentItem } from "@/lib/content";

export const dynamic = "force-dynamic";

type ProjectPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublishedContentItem("project", slug);
  return item ? { title: item.title, description: item.summary } : {};
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const item = await getPublishedContentItem("project", slug);
  if (!item) notFound();
  return <ContentDetail item={item} />;
}
