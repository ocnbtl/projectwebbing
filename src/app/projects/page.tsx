import type { Metadata } from "next";
import { WorkPage } from "@/components/public/public-pages";
import { getContentItems } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects",
  description: "Distinct businesses. Individual expressions. Explore websites by Madagin.",
  alternates: { canonical: "/projects" },
};

export default async function ProjectsPage() {
  const items = await getContentItems({ kind: "project" });
  return <WorkPage items={items} />;
}
