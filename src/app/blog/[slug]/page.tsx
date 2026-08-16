import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentDetail } from "@/components/public/public-pages";
import { getPublishedContentItem } from "@/lib/content";

export const dynamic = "force-dynamic";

type BlogPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublishedContentItem("post", slug);
  return item ? { title: item.title, description: item.summary } : {};
}

export default async function BlogDetailPage({ params }: BlogPageProps) {
  const { slug } = await params;
  const item = await getPublishedContentItem("post", slug);
  if (!item) notFound();
  return <ContentDetail item={item} />;
}
