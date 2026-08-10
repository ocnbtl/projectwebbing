import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://projectwebbing.vercel.app";
  return [{ url: origin, lastModified: new Date(), changeFrequency: "monthly" }];
}
