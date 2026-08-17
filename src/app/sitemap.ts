import type { MetadataRoute } from "next";
import { getContentItems } from "@/lib/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://projectwebbing.vercel.app";
  const [projects, posts] = await Promise.all([
    getContentItems({ kind: "project" }),
    getContentItems({ kind: "post" }),
  ]);
  const routes: MetadataRoute.Sitemap = [
    { url: origin, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${origin}/projects`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${origin}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${origin}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  ];
  for (const item of [...projects, ...posts]) {
    routes.push({
      url: `${origin}/${item.kind === "project" ? "projects" : "blog"}/${item.slug}`,
      lastModified: new Date(item.updatedAt),
      changeFrequency: "monthly",
      priority: item.kind === "project" ? 0.8 : 0.6,
    });
  }
  return routes;
}
