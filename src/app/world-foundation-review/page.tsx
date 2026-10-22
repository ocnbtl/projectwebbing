import type { Metadata } from "next";
import { notFound } from "next/navigation";
export const metadata: Metadata = { title: "Local terrain foundation study", robots: { index: false, follow: false } };
export default async function TerrainFoundationReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { TerrainFoundationLoader } = await import("@/components/internal/terrain-foundation-loader");
  return <TerrainFoundationLoader />;
}
