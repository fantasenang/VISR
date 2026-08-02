"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AnalyticsRow = {
  label: string;
  pageViews: number;
  visitors: number | null;
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
  behavior: {
    events: AnalyticsRow[];
    sections: AnalyticsRow[];
    actions: AnalyticsRow[];
    checkoutSteps: AnalyticsRow[];
  };
  updatedAt: string;
};

type ApiFailure = { error?: { code?: string; message?: string } };
type DashboardPanel = "overview" | "behavior" | "acquisition" | "audience";

const ranges = [1, 7, 30, 90] as const;
const panels: Array<{ id: DashboardPanel; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "behavior", label: "Behavior" },
  { id: "acquisition", label: "Acquisition" },
  { id: "audience", label: "Audience" },
];

const labelMap: Record<string, string> = {
  "/": "Homepage",
  "/checkout": "Checkout",
  "/order": "Track Order",
  preorder: "Preorder",
  visr_link: "VISR Link",
  visr_carry: "VISR Carry",
  halo_collection: "Halo Collection",
  preorder_details: "Preorder Details",
  final_cta: "Final Preorder CTA",
  faq: "FAQ",
  track_order: "Track Order",
  whatsapp: "WhatsApp Support",
  privacy_notice: "Privacy Notice",
  faq_open: "FAQ Opened",
  faq_close: "FAQ Closed",
  information: "Information Step",
  payment: "Payment Step",
  mobile: "Mobile",
  desktop: "Desktop",
  tablet: "Tablet",
};

function number(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("id-ID").format(value);
}

function dateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(parsed);
}

function displayLabel(value: string, kind?: "country") {
  if (!value || value === "Unknown") return "Direct / unknown";
  if (labelMap[value]) return labelMap[value];
  if (kind === "country" && /^[A-Z]{2}$/.test(value)) {
    try {
      const name = new Intl.DisplayNames(["en"], { type: "region" }).of(value);
      return name ? `${name} · ${value}` : value;
    } catch {
      return value;
    }
  }
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function changeText(value: number | null) {
  if (value === null) return null;
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("id-ID")}% vs previous period`;
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
      {changeText(change ?? null) ? (
        <p className={`mt-2 text-[10px] ${change && change > 0 ? "text-emerald-200/55" : "text-white/35"}`}>
          {changeText(change ?? null)}
        </p>
      ) : null}
    </div>
  );
}

function Breakdown({
  title,
  rows,
  total,
  empty = "No data yet.",
  country = false,
  metric = "views",
}: {
  title: string;
  rows: AnalyticsRow[];
  total?: number;
  empty?: string;
  country?: boolean;
  metric?: "views" | "events";
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
                <span className="min-w-0 text-sm leading-5 text-white/68">
                  {displayLabel(row.label, country ? "country" : undefined)}
                </span>
                <span className="shrink-0 font-mono text-xs text-white/55">{number(row.pageViews)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/30">
                <span>{metric}</span>
                {row.visitors !== null ? <span>{number(row.visitors)} unique visitors</span> : null}
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
        {rows.length === 0 ? <p className="py-8 text-sm text-white/30">{empty}</p> : null}
      </div>
    </section>
  );
}

function QuickRead({ data }: { data: AnalyticsData }) {
  const cards = [
    { label: "Most viewed", value: displayLabel(data.pages[0]?.label ?? "—"), metric: data.pages[0]?.pageViews },
    {
      label: "Leading source",
      value: displayLabel(data.referrers[0]?.label ?? "Unknown"),
      metric: data.referrers[0]?.pageViews,
    },
    { label: "Primary device", value: displayLabel(data.devices[0]?.label ?? "—"), metric: data.devices[0]?.pageViews },
    {
      label: "Top country",
      value: displayLabel(data.countries[0]?.label ?? "—", "country"),
      metric: data.countries[0]?.pageViews,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <p className="text-[9px] uppercase tracking-[0.16em] text-white/30">{card.label}</p>
          <p className="mt-3 truncate text-base text-white/75">{card.value}</p>
          {card.metric !== undefined ? <p className="mt-1 font-mono text-[10px] text-white/30">{card.metric} views</p> : null}
        </div>
      ))}
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
  lines.push(["Views today", data.summary.todayPageViews].map(csvCell).join(","));
  lines.push(["Visitors today", data.summary.todayVisitors].map(csvCell).join(","));
  lines.push("");

  addRows("Daily trend", data.trend);
  addRows("Top pages", data.pages);
  addRows("Referrers", data.referrers);
  addRows("UTM sources", data.utmSources);
  addRows("UTM mediums", data.utmMediums);
  addRows("UTM campaigns", data.utmCampaigns);
  addRows("Devices", data.devices);
  addRows("Operating systems", data.operatingSystems);
  addRows("Browsers", data.browsers);
  addRows("Countries", data.countries);
  addRows("Behavior events", data.behavior.events);
  addRows("Section interest", data.behavior.sections);
  addRows("Actions", data.behavior.actions);
  addRows("Checkout funnel", data.behavior.checkoutSteps);
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
          <p className="mt-2 text-sm leading-6 text-white/38">
            Anonymous traffic, acquisition, audience, and website behavior from Vercel Web Analytics.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="/visr-control" className="rounded-full border border-white/15 px-4 py-2.5 text-xs transition hover:bg-white hover:text-black">
              Back to Control
            </a>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!data || loading}
              className="rounded-full border border-white/15 px-4 py-2.5 text-xs transition hover:bg-white hover:text-black disabled:opacity-35"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-full border border-white/15 px-4 py-2.5 text-xs transition hover:bg-white hover:text-black disabled:opacity-35"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </header>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {ranges.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-sm ${days === value ? "bg-white text-black" : "border border-white/10 text-white/55"}`}
            >
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
              <SummaryCard label="Page views" value={number(data.summary.pageViews)} change={data.summary.pageViewsChange} />
              <SummaryCard label="Visitors" value={number(data.summary.visitors)} change={data.summary.visitorsChange} />
              <SummaryCard
                label="Views / visitor"
                value={data.summary.viewsPerVisitor?.toLocaleString("id-ID") ?? "—"}
                detail="Average pages opened by each anonymous visitor."
              />
              <SummaryCard
                label="Today"
                value={`${number(data.summary.todayPageViews)} / ${number(data.summary.todayVisitors)}`}
                detail="Views / visitors today in WIB."
              />
            </section>

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Traffic trend</p>
                  <h2 className="mt-3 text-2xl tracking-[-0.03em]">Daily page views</h2>
                </div>
                <p className="text-[10px] text-white/30">
                  Updated {new Date(data.updatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
                </p>
              </div>

              <div className="mt-7 flex h-52 items-end gap-2 overflow-x-auto border-b border-white/10 pb-7">
                {trend.map((row) => (
                  <div key={row.label} className="flex h-full min-w-10 flex-1 flex-col items-center justify-end gap-2">
                    <span className="font-mono text-[9px] text-white/35">
                      {row.pageViews}{row.visitors !== null ? ` / ${row.visitors}` : ""}
                    </span>
                    <div
                      className="w-full max-w-12 rounded-t-md bg-white/55"
                      style={{ height: `${Math.max(3, (row.pageViews / maxTrend) * 100)}%` }}
                      title={`${dateLabel(row.label)}: ${row.pageViews} views, ${row.visitors ?? "—"} visitors`}
                    />
                    <span className="whitespace-nowrap text-[9px] text-white/28">{dateLabel(row.label)}</span>
                  </div>
                ))}
                {trend.length === 0 ? <p className="m-auto text-sm text-white/30">Traffic data will appear after visits are recorded.</p> : null}
              </div>
              <p className="mt-3 text-[10px] text-white/25">Bar labels show page views / unique visitors.</p>
            </section>

            <div className="mt-6 flex gap-2 overflow-x-auto border-b border-white/10 pb-4">
              {panels.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPanel(item.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs ${panel === item.id ? "bg-white text-black" : "border border-white/10 text-white/50"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {panel === "overview" ? (
                <div className="space-y-4">
                  <QuickRead data={data} />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Breakdown title="Top pages" rows={data.pages} total={data.summary.pageViews} />
                    <Breakdown
                      title="Traffic sources"
                      rows={data.referrers}
                      total={data.summary.pageViews}
                      empty="Direct traffic or no referrer data yet."
                    />
                  </div>
                </div>
              ) : null}

              {panel === "behavior" ? (
                <div>
                  <div className="mb-4 rounded-2xl border border-white/8 bg-white/[0.018] p-4 text-xs leading-6 text-white/38">
                    Behavior events start accumulating from this analytics upgrade. They show anonymous section interest, support clicks, preorder CTA activity, and checkout progression.
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Breakdown title="Event activity" rows={data.behavior.events} metric="events" />
                    <Breakdown title="Section interest" rows={data.behavior.sections} metric="events" />
                    <Breakdown title="Clicked actions" rows={data.behavior.actions} metric="events" />
                    <Breakdown
                      title="Checkout funnel"
                      rows={data.behavior.checkoutSteps}
                      metric="events"
                      empty="Checkout events will appear after preorder opens and visitors continue through checkout."
                    />
                  </div>
                </div>
              ) : null}

              {panel === "acquisition" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Breakdown title="Referrer websites" rows={data.referrers} total={data.summary.pageViews} />
                  <Breakdown title="UTM sources" rows={data.utmSources} total={data.summary.pageViews} empty="Add UTM tags to campaign links to populate this section." />
                  <Breakdown title="UTM mediums" rows={data.utmMediums} total={data.summary.pageViews} empty="No tagged campaign medium yet." />
                  <Breakdown title="UTM campaigns" rows={data.utmCampaigns} total={data.summary.pageViews} empty="No tagged campaign name yet." />
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
            </div>
          </>
        ) : null}

        {!error && loading && !data ? <p className="py-24 text-center text-sm text-white/35">Loading website analytics…</p> : null}
      </div>
    </main>
  );
}
