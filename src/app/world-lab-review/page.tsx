import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Local world lab review",
};

export default async function LocalWorldLabReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { WorldLabLoader } = await import("@/components/internal/world-lab-loader");
  return <WorldLabLoader />;
}
