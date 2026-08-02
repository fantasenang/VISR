"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AnalyticsRow = {
  label: string;
  pageViews: number;
  visitors: number | null;
};

type FunnelRow = AnalyticsRow & {
  rateFromVisitors: number | null;
  rateFromPrevious: number | null;
};

type AnalyticsData = {
  range: {
    days: number;
    since: string;
    until: string;
    previousSince: string;
    previousUntil: string;
  };
  summary: {
    pageViews: number;
    visitors: number | null;
    todayPageViews: number;
    todayVisitors: number | null;
    viewsPerVisitor: number | null;
    previousPageViews: number;
    previousVisitors: number | null;
    pageViewsChange: number | null;
    visitorsChange: number | null;
  };
  trend: AnalyticsRow[];
  pages: AnalyticsRow[];
  referrers: AnalyticsRow[];
  devices: AnalyticsRow[];
  countries: AnalyticsRow[];
  browsers: AnalyticsRow[];
  operatingSystems: AnalyticsRow[];
  utmSources: AnalyticsRow[];
  utmMediums: AnalyticsRow[];
  utmCampaigns: AnalyticsRow[];
  funnel: FunnelRow[];
  behavior: {
    events: AnalyticsRow[];
    sections: AnalyticsRow[];
    actions: AnalyticsRow[];
    checkoutSteps: AnalyticsRow[];
  };
  sessions: {
    landingPages: AnalyticsRow[];
    sourceTypes: AnalyticsRow[];
    viewports: AnalyticsRow[];
    orientations: AnalyticsRow[];
    visitHours: AnalyticsRow[];
    weekdays: AnalyticsRow[];
    scrollDepth: AnalyticsRow[];
    engagedTime: AnalyticsRow[];
    exitSections: AnalyticsRow[];
    sectionsSeen: AnalyticsRow[];
    pageSummaries: AnalyticsRow[];
  };
  updatedAt: string;
};

type ApiFailure = { error?: { code?: string; message?: string } };
type DashboardPanel = "overview" | "engagement" | "acquisition" | "audience" | "funnel";

const ranges = [1, 7, 30, 90] as const;
const panels: Array<{ id: DashboardPanel; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "engagement", label: "Engagement" },
  { id: "acquisition", label: "Acquisition" },
  { id: "audience", label: "Audience" },
  { id: "funnel", label: "Funnel" },
];

const labelMap: Record<string, string> = {
  "/": "Homepage",
  "/checkout": "Checkout",
  "/order": "Track Order",
  website_visitors: "Website Visitors",
  preorder_cta: "Preorder CTA",
  checkout_viewed: "Checkout Viewed",
  information: "Information Submitted",
  payment: "Payment Opened",
  opening: "Opening",
  preorder: "Preorder",
  visr_link: "VISR Link",
  visr_carry: "VISR Carry",
  halo_collection: "Halo Collection",
  preorder_details: "Preorder Details",
  final_cta: "Final Preorder CTA",
  faq: "FAQ",
  direct: "Direct / unknown",
  mobile: "Mobile",
  desktop: "Desktop",
  tablet: "Tablet",
  scroll_0_24: "0–24% Reached",
  scroll_25_49: "25–49% Reached",
  scroll_50_74: "50–74% Reached",
  scroll_75_89: "75–89% Reached",
  scroll_90_100: "90–100% Reached",
  time_under_15s: "Under 15 Seconds",
  time_15_44s: "15–44 Seconds",
  time_45_89s: "45–89 Seconds",
  time_90_179s: "90–179 Seconds",
  time_180s_plus: "3 Minutes or More",
};

function formatNumber(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("id-ID").format(value);
}

function displayLabel(value: string, country = false) {
  if (!value || value === "Unknown") return "Direct / unknown";
  if (labelMap[value]) return labelMap[value];
  if (country && /^[A-Z]{2}$/.test(value)) {
    try {
      const name = new Intl.DisplayNames(["en"], { type: "region" }).of(value);
      return name ? `${name} · ${value}` : value;
    } catch {
      return value;
    }
  }
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function changeLabel(value: number | null) {
  if (value === null) return null;
  return `${value > 0 ? "+" : ""}${value.toLocaleString("id-ID")}% vs previous period`;
}

function SummaryCard({
  label,
  value,
  detail,
  change,
}: {
  label: string;
  value: string;
  detail?: string;
  change?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <p className="text-[9px] uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-3 text-3xl tracking-[-0.04em]">{value}</p>
      {detail ? <p className="mt-2 text-[11px] leading-5 text-white/35">{detail}</p> : null}
      {changeLabel(change ?? null) ? (
        <p className={`mt-2 text-[10px] ${change && change > 0 ? "text-emerald-200/55" : "text-white/35"}`}>
          {changeLabel(change ?? null)}
        </p>
      ) : null}
    </div>
  );
}

function Breakdown({
  title,
  rows,
  total,
  country = false,
  metric = "views",
  empty = "No data recorded yet.",
}: {
  title: string;
  rows: AnalyticsRow[];
  total?: number;
  country?: boolean;
  metric?: "views" | "events" | "sessions";
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.pageViews));
  const denominator = total && total > 0 ? total : rows.reduce((sum, row) => sum + row.pageViews, 0);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">{title}</p>
      <div className="mt-5 space-y-4">
        {rows.map((row) => {
          const share = denominator > 0 ? (row.pageViews / denominator) * 100 : 0;
          return (
            <div key={`${title}-${row.label}`}>
              <div className="flex items-start justify-between gap-4">
                <span className="min-w-0 text-sm leading-5 text-white/68">{displayLabel(row.label, country)}</span>
                <span className="shrink-0 font-mono text-xs text-white/55">{formatNumber(row.pageViews)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/30">
                <span>{metric}</span>
                {row.visitors !== null ? <span>{formatNumber(row.visitors)} unique visitors</span> : null}
                {denominator > 0 ? <span>{share.toFixed(1)}% share</span> : null}
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-white/55"
                  style={{ width: `${Math.max(2, (row.pageViews / max) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
        {rows.length === 0 ? <p className="py-8 text-sm leading-6 text-white/30">{empty}</p> : null}
      </div>
    </section>
  );
}

function FeatureNotice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.035] p-5 sm:p-6">
      <p className="text-[10px] uppercase tracking-[0.16em] text-amber-100/45">Plan limitation</p>
      <h2 className="mt-3 text-xl tracking-[-0.025em]">{title}</h2>
      <div className="mt-3 max-w-3xl text-xs leading-6 text-white/42">{children}</div>
    </section>
  );
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function analyticsCsv(data: AnalyticsData) {
  const lines: string[] = [];
  const addRows = (section: string, rows: AnalyticsRow[]) => {
    lines.push(csvCell(section));
    lines.push(["Label", "Count", "Unique visitors"].map(csvCell).join(","));
    for (const row of rows) lines.push([row.label, row.pageViews, row.visitors].map(csvCell).join(","));
    lines.push("");
  };

  lines.push(["VISR Website Analytics", data.range.days === 1 ? "Today" : `${data.range.days} days`].map(csvCell).join(","));
  lines.push(["Updated", data.updatedAt].map(csvCell).join(","));
  lines.push("");
  lines.push(["Metric", "Value"].map(csvCell).join(","));
  lines.push(["Page views", data.summary.pageViews].map(csvCell).join(","));
  lines.push(["Visitors", data.summary.visitors].map(csvCell).join(","));
  lines.push(["Views per visitor", data.summary.viewsPerVisitor].map(csvCell).join(","));
  lines.push("");
  addRows("Daily trend", data.trend);
  addRows("Top pages", data.pages);
  addRows("Referrers", data.referrers);
  addRows("Devices", data.devices);
  addRows("Operating systems", data.operatingSystems);
  addRows("Browsers", data.browsers);
  addRows("Countries", data.countries);
  addRows("UTM sources", data.utmSources);
  addRows("UTM mediums", data.utmMediums);
  addRows("UTM campaigns", data.utmCampaigns);
  addRows("Custom events", data.behavior.events);
  return lines.join("\n");
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<(typeof ranges)[number]>(7);
  const [panel, setPanel] = useState<DashboardPanel>("overview");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/analytics?days=${days}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as AnalyticsData & ApiFailure;
      if (response.status === 401) {
        window.location.assign("/visr-control");
        return;
      }
      if (!response.ok) {
        throw Object.assign(new Error(payload.error?.message ?? "Analytics could not be loaded."), {
          code: payload.error?.code ?? "ANALYTICS_FAILED",
        });
      }
      setData(payload);
    } catch (cause) {
      const typed = cause as Error & { code?: string };
      setError({ code: typed.code ?? "ANALYTICS_FAILED", message: typed.message });
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const trend = useMemo(
    () => [...(data?.trend ?? [])].sort((left, right) => new Date(left.label).getTime() - new Date(right.label).getTime()),
    [data?.trend],
  );
  const maxTrend = Math.max(1, ...trend.map((row) => row.pageViews));

  const hasCustomEvents = Boolean(
    data && (
      data.behavior.events.length ||
      data.behavior.sections.length ||
      data.behavior.actions.length ||
      data.sessions.scrollDepth.length ||
      data.sessions.engagedTime.length
    ),
  );
  const hasUtm = Boolean(data && (data.utmSources.length || data.utmMediums.length || data.utmCampaigns.length));

  const acquisitionRows = useMemo(() => {
    if (!data) return [];
    const referredViews = data.referrers.reduce((sum, row) => sum + row.pageViews, 0);
    const directViews = Math.max(0, data.summary.pageViews - referredViews);
    const directVisitors = data.referrers.length === 0 ? data.summary.visitors : null;
    return [
      ...(directViews > 0 ? [{ label: "direct", pageViews: directViews, visitors: directVisitors }] : []),
      ...data.referrers,
    ];
  }, [data]);

  const exportCsv = useCallback(() => {
    if (!data) return;
    const blob = new Blob([analyticsCsv(data)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `visr-analytics-${data.range.days === 1 ? "today" : `${data.range.days}d`}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <main className="min-h-screen bg-[#030303] px-4 py-6 text-[#f5f5f2] sm:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm tracking-[0.24em]">VISR</p>
          <h1 className="mt-2 text-3xl tracking-[-0.045em]">Website Analytics</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/38">
            Anonymous production traffic from Vercel Web Analytics. Unsupported paid metrics are labelled clearly instead of appearing as empty data.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="/visr-control" className="rounded-full border border-white/15 px-4 py-2.5 text-xs transition hover:bg-white hover:text-black">
              Back to Control
            </a>
            <button type="button" onClick={exportCsv} disabled={!data || loading} className="rounded-full border border-white/15 px-4 py-2.5 text-xs transition hover:bg-white hover:text-black disabled:opacity-35">
              Export CSV
            </button>
            <button type="button" onClick={() => void load()} disabled={loading} className="rounded-full border border-white/15 px-4 py-2.5 text-xs transition hover:bg-white hover:text-black disabled:opacity-35">
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </header>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {ranges.map((value) => (
            <button key={value} type="button" onClick={() => setDays(value)} className={`shrink-0 rounded-full px-5 py-2.5 text-sm ${days === value ? "bg-white text-black" : "border border-white/10 text-white/55"}`}>
              {value === 1 ? "Today" : `${value} days`}
            </button>
          ))}
        </div>

        {error ? (
          <section className="mt-7 rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-6">
            <p className="text-[10px] uppercase tracking-[0.16em] text-amber-100/45">Analytics needs attention</p>
            <h2 className="mt-4 text-2xl tracking-[-0.03em]">Data could not be loaded.</h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/52">{error.message}</p>
          </section>
        ) : null}

        {!error && data ? (
          <>
            <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryCard label="Page views" value={formatNumber(data.summary.pageViews)} change={data.summary.pageViewsChange} />
              <SummaryCard label="Visitors" value={formatNumber(data.summary.visitors)} change={data.summary.visitorsChange} />
              <SummaryCard label="Views / visitor" value={data.summary.viewsPerVisitor?.toLocaleString("id-ID") ?? "—"} detail="A practical engagement signal available on the base plan." />
              <SummaryCard label="Today" value={`${formatNumber(data.summary.todayPageViews)} / ${formatNumber(data.summary.todayVisitors)}`} detail="Views / visitors today in WIB." />
            </section>

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Traffic trend</p>
                  <h2 className="mt-3 text-2xl tracking-[-0.03em]">Daily page views</h2>
                </div>
                <p className="text-[10px] text-white/30">Updated {new Date(data.updatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</p>
              </div>
              <div className="mt-7 flex h-52 items-end gap-2 overflow-x-auto border-b border-white/10 pb-7">
                {trend.map((row) => (
                  <div key={row.label} className="flex h-full min-w-10 flex-1 flex-col items-center justify-end gap-2">
                    <span className="font-mono text-[9px] text-white/35">{row.pageViews}{row.visitors !== null ? ` / ${row.visitors}` : ""}</span>
                    <div className="w-full max-w-12 rounded-t-md bg-white/55" style={{ height: `${Math.max(3, (row.pageViews / maxTrend) * 100)}%` }} />
                    <span className="whitespace-nowrap text-[9px] text-white/28">{dateLabel(row.label)}</span>
                  </div>
                ))}
                {trend.length === 0 ? <p className="m-auto text-sm text-white/30">Traffic data will appear after visits are recorded.</p> : null}
              </div>
            </section>

            <div className="mt-6 flex gap-2 overflow-x-auto border-b border-white/10 pb-4">
              {panels.map((item) => (
                <button key={item.id} type="button" onClick={() => setPanel(item.id)} className={`shrink-0 rounded-full px-4 py-2 text-xs ${panel === item.id ? "bg-white text-black" : "border border-white/10 text-white/50"}`}>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {panel === "overview" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Breakdown title="Top pages" rows={data.pages} total={data.summary.pageViews} />
                  <Breakdown title="Traffic sources" rows={acquisitionRows} total={data.summary.pageViews} />
                  <Breakdown title="Devices" rows={data.devices} total={data.summary.pageViews} />
                  <Breakdown title="Countries" rows={data.countries} total={data.summary.pageViews} country />
                </div>
              ) : null}

              {panel === "engagement" ? (
                <div className="space-y-4">
                  <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <SummaryCard label="Views / visitor" value={data.summary.viewsPerVisitor?.toLocaleString("id-ID") ?? "—"} />
                    <SummaryCard label="Additional views" value={formatNumber(Math.max(0, data.summary.pageViews - (data.summary.visitors ?? data.summary.pageViews)))} detail="Page views beyond the first view per visitor." />
                    <SummaryCard label="Most viewed" value={displayLabel(data.pages[0]?.label ?? "—")} detail={`${formatNumber(data.pages[0]?.pageViews ?? 0)} views`} />
                    <SummaryCard label="Pages recorded" value={formatNumber(data.pages.length)} />
                  </section>
                  <Breakdown title="Content interest by page" rows={data.pages} total={data.summary.pageViews} />
                  {hasCustomEvents ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Breakdown title="Section interest" rows={data.behavior.sections} metric="events" />
                      <Breakdown title="Scroll depth" rows={data.sessions.scrollDepth} metric="sessions" />
                      <Breakdown title="Active time" rows={data.sessions.engagedTime} metric="sessions" />
                      <Breakdown title="Last visible section" rows={data.sessions.exitSections} metric="sessions" />
                    </div>
                  ) : (
                    <FeatureNotice title="Scroll depth and active time need Vercel Custom Events">
                      The base Web Analytics plan records page views and audience breakdowns. Scroll percentage, active time, section views, CTA clicks, and checkout progression require Custom Events, which Vercel limits to Pro and Enterprise plans.
                    </FeatureNotice>
                  )}
                </div>
              ) : null}

              {panel === "acquisition" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Breakdown title="Traffic source" rows={acquisitionRows} total={data.summary.pageViews} />
                    <Breakdown title="Destination pages" rows={data.pages} total={data.summary.pageViews} />
                  </div>
                  {hasUtm ? (
                    <div className="grid gap-4 lg:grid-cols-3">
                      <Breakdown title="UTM sources" rows={data.utmSources} total={data.summary.pageViews} />
                      <Breakdown title="UTM mediums" rows={data.utmMediums} total={data.summary.pageViews} />
                      <Breakdown title="UTM campaigns" rows={data.utmCampaigns} total={data.summary.pageViews} />
                    </div>
                  ) : (
                    <FeatureNotice title="Detailed UTM campaign reports need Web Analytics Plus">
                      Direct traffic and normal referring websites are shown above. Vercel reserves UTM source, medium, and campaign breakdowns for Web Analytics Plus and Enterprise.
                    </FeatureNotice>
                  )}
                </div>
              ) : null}

              {panel === "audience" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Breakdown title="Devices" rows={data.devices} total={data.summary.pageViews} />
                  <Breakdown title="Operating systems" rows={data.operatingSystems} total={data.summary.pageViews} />
                  <Breakdown title="Browsers" rows={data.browsers} total={data.summary.pageViews} />
                  <Breakdown title="Countries" rows={data.countries} total={data.summary.pageViews} country />
                </div>
              ) : null}

              {panel === "funnel" ? (
                hasCustomEvents ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Breakdown title="Clicked actions" rows={data.behavior.actions} metric="events" />
                    <Breakdown title="Checkout steps" rows={data.behavior.checkoutSteps} metric="events" />
                  </div>
                ) : (
                  <FeatureNotice title="Conversion funnel needs Vercel Custom Events">
                    Visitor totals remain available, but preorder clicks, checkout opens, information submission, and payment intent cannot be measured through the free page-view dataset alone.
                  </FeatureNotice>
                )
              ) : null}
            </div>
          </>
        ) : null}

        {!error && loading && !data ? <p className="py-24 text-center text-sm text-white/35">Loading website analytics…</p> : null}
      </div>
    </main>
  );
}
