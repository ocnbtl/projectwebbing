import { AnalyticsDashboard } from "@/components/internal/analytics-dashboard";
import { getAnalyticsSnapshot } from "@/lib/vercel-analytics";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const snapshot = await getAnalyticsSnapshot(30);
  return <AnalyticsDashboard snapshot={snapshot} />;
}
