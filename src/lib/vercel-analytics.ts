import "server-only";

type AnalyticsRow = Record<string, string | number | null | undefined> & {
  pageviews?: number;
  visitors?: number;
};

export type AnalyticsBreakdown = {
  label: string;
  pageviews: number;
  visitors: number;
};

export type AnalyticsPoint = {
  date: string;
  pageviews: number;
  visitors: number;
};

export type AnalyticsSnapshot = {
  status: "ready" | "unconfigured" | "error";
  since: string;
  until: string;
  pageviews: number | null;
  visitors: number | null;
  daily: AnalyticsPoint[];
  pages: AnalyticsBreakdown[];
  referrers: AnalyticsBreakdown[];
  devices: AnalyticsBreakdown[];
  message?: string;
};

const API_ROOT = "https://api.vercel.com/v1/query/web-analytics";

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function configuration() {
  return {
    token: process.env.VERCEL_ANALYTICS_TOKEN,
    projectId: process.env.VERCEL_ANALYTICS_PROJECT_ID,
    teamId: process.env.VERCEL_ANALYTICS_TEAM_ID,
    slug: process.env.VERCEL_ANALYTICS_TEAM_SLUG,
  };
}

function emptySnapshot(
  status: AnalyticsSnapshot["status"],
  since: string,
  until: string,
  message: string,
): AnalyticsSnapshot {
  return {
    status,
    since,
    until,
    pageviews: null,
    visitors: null,
    daily: [],
    pages: [],
    referrers: [],
    devices: [],
    message,
  };
}

async function aggregate(
  by: "day" | "requestPath" | "referrerHostname" | "deviceType",
  since: string,
  until: string,
  limit?: number,
) {
  const config = configuration();
  const url = new URL(`${API_ROOT}/visits/aggregate`);
  url.searchParams.set("projectId", config.projectId || "");
  url.searchParams.set("since", since);
  url.searchParams.set("until", until);
  url.searchParams.set("by", by);
  if (config.teamId) url.searchParams.set("teamId", config.teamId);
  if (!config.teamId && config.slug) url.searchParams.set("slug", config.slug);
  if (limit) url.searchParams.set("limit", String(limit));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Vercel Analytics responded with ${response.status}.`);
  }

  const payload = (await response.json()) as { data?: AnalyticsRow[] };
  return Array.isArray(payload.data) ? payload.data : [];
}

function breakdown(rows: AnalyticsRow[], dimension: string) {
  return rows.map((row) => ({
    label: String(row[dimension] || "Direct / none"),
    pageviews: Number(row.pageviews || 0),
    visitors: Number(row.visitors || 0),
  }));
}

export async function getAnalyticsSnapshot(
  days = 30,
): Promise<AnalyticsSnapshot> {
  const untilDate = new Date();
  const sinceDate = new Date(untilDate);
  sinceDate.setUTCDate(sinceDate.getUTCDate() - (days - 1));
  const since = dateOnly(sinceDate);
  const until = dateOnly(untilDate);
  const config = configuration();

  if (!config.token || !config.projectId || (!config.teamId && !config.slug)) {
    return emptySnapshot(
      "unconfigured",
      since,
      until,
      "Connect Vercel Web Analytics to begin.",
    );
  }

  try {
    const [dailyRows, pageRows, referrerRows, deviceRows] = await Promise.all([
      aggregate("day", since, until),
      aggregate("requestPath", since, until, 5),
      aggregate("referrerHostname", since, until, 5),
      aggregate("deviceType", since, until, 5),
    ]);

    const daily = dailyRows.map((row) => ({
      date: String(row.timestamp || row.day || ""),
      pageviews: Number(row.pageviews || 0),
      visitors: Number(row.visitors || 0),
    }));

    return {
      status: "ready",
      since,
      until,
      pageviews: daily.reduce((sum, point) => sum + point.pageviews, 0),
      visitors: daily.reduce((sum, point) => sum + point.visitors, 0),
      daily,
      pages: breakdown(pageRows, "requestPath"),
      referrers: breakdown(referrerRows, "referrerHostname"),
      devices: breakdown(deviceRows, "deviceType"),
    };
  } catch {
    return emptySnapshot(
      "error",
      since,
      until,
      "Analytics could not be loaded. Check the Vercel connection and try again.",
    );
  }
}
