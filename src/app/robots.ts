import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || "https://madagin.com"}/sitemap.xml`,
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/internal/",
    },
  };
}
