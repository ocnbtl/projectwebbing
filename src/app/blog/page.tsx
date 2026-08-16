import type { Metadata } from "next";
import { ContentIndex } from "@/components/public/public-pages";
import { getContentItems } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes from Madagin on perspective, design, and building a distinctive online presence.",
};

export default async function BlogPage() {
  const items = await getContentItems({ kind: "post" });
  return <ContentIndex items={items} kind="post" />;
}
