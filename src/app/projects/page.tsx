import type { Metadata } from "next";
import { ContentIndex } from "@/components/public/public-pages";
import { getContentItems } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects",
  description: "Selected Madagin website work and the decisions behind it.",
};

export default async function ProjectsPage() {
  const items = await getContentItems({ kind: "project" });
  return <ContentIndex items={items} kind="project" />;
}
