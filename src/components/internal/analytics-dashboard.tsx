import type {
  AnalyticsBreakdown,
  AnalyticsSnapshot,
} from "@/lib/vercel-analytics";
import styles from "./analytics-dashboard.module.css";

function formatNumber(value: number | null) {
  return value === null ? "\u2014" : new Intl.NumberFormat("en-US").format(value);
}

function dateLabel(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function TrafficPlot({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const points = snapshot.daily;
  const hasData = points.some((point) => point.pageviews > 0);
  const max = Math.max(1, ...points.map((point) => point.pageviews));
  const polyline = points
    .map((point, index) => {
      const x = points.length <= 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 92 - (point.pageviews / max) * 78;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className={styles.plot} aria-labelledby="traffic-title">
      <div className={styles.sectionHead}>
        <h2 id="traffic-title">Daily traffic</h2>
        <span>{dateLabel(snapshot.since)}{"\u2014"}{dateLabel(snapshot.until)}</span>
      </div>
      <div className={styles.plotArea}>
        <svg
          aria-label={hasData ? "Daily page views for the selected period" : "No traffic data available"}
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 100 100"
        >
          <line x1="0" x2="100" y1="14" y2="14" />
          <line x1="0" x2="100" y1="40" y2="40" />
          <line x1="0" x2="100" y1="66" y2="66" />
          <line x1="0" x2="100" y1="92" y2="92" />
          {hasData ? <polyline points={polyline} /> : null}
        </svg>
        {!hasData ? (
          <div className={styles.emptyPlot}>
            <strong>{snapshot.message || "No visits in this period yet."}</strong>
            <span>
              {snapshot.status === "unconfigured"
                ? "The dashboard will populate from Vercel once the server connection is configured."
                : snapshot.status === "error"
                  ? "No invented totals are shown while the connection is unavailable."
                  : "New production visits will appear here automatically."}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Breakdown({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: AnalyticsBreakdown[];
  empty: string;
}) {
  return (
    <section className={styles.breakdown}>
      <h2>{title}</h2>
      {rows.length ? (
        <ol>
          {rows.map((row) => (
            <li key={row.label}>
              <span>{row.label}</span>
              <strong>{formatNumber(row.pageviews)}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}

export function AnalyticsDashboard({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>Site attention</p>
          <h1>Analytics</h1>
        </div>
        <span className={styles.range}>Last 30 days</span>
      </header>

      <section className={styles.metrics} aria-label="Traffic totals">
        <div>
          <span>Visitors</span>
          <strong>{formatNumber(snapshot.visitors)}</strong>
        </div>
        <div>
          <span>Page views</span>
          <strong>{formatNumber(snapshot.pageviews)}</strong>
        </div>
        <div className={styles.sourceMetric}>
          <span>Source</span>
          <strong>Vercel</strong>
          <small>{snapshot.status === "ready" ? "Connected" : "Awaiting connection"}</small>
        </div>
      </section>

      <TrafficPlot snapshot={snapshot} />

      <div className={styles.breakdownGrid}>
        <Breakdown title="Top pages" rows={snapshot.pages} empty="No page data yet." />
        <Breakdown title="Referrers" rows={snapshot.referrers} empty="No referrer data yet." />
        <Breakdown title="Devices" rows={snapshot.devices} empty="No device data yet." />
      </div>

      <aside className={styles.privacyNote}>
        <span>Privacy note</span>
        <p>
          This view uses Vercel&apos;s aggregated, cookie-free Web Analytics data. Internal
          workspace routes are excluded from tracking.
        </p>
        <a href="https://vercel.com/docs/analytics" target="_blank" rel="noreferrer">
          Vercel Analytics documentation <span aria-hidden="true">{"\u2197"}</span>
        </a>
      </aside>
    </div>
  );
}
