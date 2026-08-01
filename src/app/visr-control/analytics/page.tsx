"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AnalyticsRow = {
  label: string;
  pageViews: number;
  visitors: number | null;
};

type AnalyticsData = {
  range: { days: number; since: string; until: string };
  summary: {
    pageViews: number;
    visitors: number | null;
    todayPageViews: number;
    todayVisitors: number | null;
    viewsPerVisitor: number | null;
  };
  trend: AnalyticsRow[];
  pages: AnalyticsRow[];
  referrers: AnalyticsRow[];
  devices: AnalyticsRow[];
  countries: AnalyticsRow[];
  browsers: AnalyticsRow[];
  updatedAt: string;
};

type ApiFailure = { error?: { code?: string; message?: string } };

const ranges = [1, 7, 30, 90] as const;

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

function Breakdown({ title, rows, empty = "No data yet." }: { title: string; rows: AnalyticsRow[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.pageViews));
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">{title}</p>
      <div className="mt-5 space-y-4">
        {rows.map((row) => (
          <div key={`${title}-${row.label}`}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="min-w-0 truncate text-white/65">{row.label || "Direct / unknown"}</span>
              <span className="shrink-0 font-mono text-xs text-white/45">{number(row.pageViews)}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-white/55" style={{ width: `${Math.max(2, (row.pageViews / max) * 100)}%` }} />
            </div>
          </div>
        ))}
        {rows.length === 0 ? <p className="py-8 text-sm text-white/30">{empty}</p> : null}
      </div>
    </section>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<(typeof ranges)[number]>(7);
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

  return (
    <main className="min-h-screen bg-[#030303] px-4 py-6 text-[#f5f5f2] sm:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-6">
          <div>
            <p className="text-sm tracking-[0.24em]">VISR</p>
            <h1 className="mt-2 text-3xl tracking-[-0.045em]">Website Analytics</h1>
            <p className="mt-2 text-sm text-white/38">Anonymous production traffic from Vercel Web Analytics.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/visr-control" className="rounded-full border border-white/15 px-5 py-3 text-sm transition hover:bg-white hover:text-black">
              Back to Control
            </a>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-full border border-white/15 px-5 py-3 text-sm transition hover:bg-white hover:text-black disabled:opacity-40"
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
              className={`rounded-full px-5 py-2.5 text-sm ${days === value ? "bg-white text-black" : "border border-white/10 text-white/55"}`}
            >
              {value === 1 ? "Today" : `${value} days`}
            </button>
          ))}
        </div>

        {error ? (
          <section className="mt-7 rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-6">
            <p className="text-[10px] uppercase tracking-[0.16em] text-amber-100/45">Analytics setup</p>
            <h2 className="mt-4 text-2xl tracking-[-0.03em]">Dashboard is ready; server access is not configured.</h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/52">{error.message}</p>
            {error.code === "VERCEL_ANALYTICS_TOKEN_MISSING" ? (
              <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-5 text-sm leading-7 text-white/55">
                Create a Vercel Access Token scoped to the <strong className="text-white/80">fantake</strong> team, then add it to this project as the server-only environment variable <code className="rounded bg-white/8 px-2 py-1 text-white/75">VERCEL_ACCESS_TOKEN</code>. Redeploy once after saving it.
              </div>
            ) : null}
          </section>
        ) : null}

        {!error && data ? (
          <>
            <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Page views", number(data.summary.pageViews)],
                ["Visitors", number(data.summary.visitors)],
                ["Views today", number(data.summary.todayPageViews)],
                ["Visitors today", number(data.summary.todayVisitors)],
                ["Views / visitor", data.summary.viewsPerVisitor?.toLocaleString("id-ID") ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</p>
                  <p className="mt-4 text-3xl tracking-[-0.04em]">{value}</p>
                </div>
              ))}
            </section>

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Traffic trend</p>
                  <h2 className="mt-3 text-2xl tracking-[-0.03em]">Daily page views</h2>
                </div>
                <p className="text-xs text-white/30">Updated {new Date(data.updatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</p>
              </div>

              <div className="mt-8 flex h-56 items-end gap-2 overflow-x-auto border-b border-white/10 pb-7">
                {trend.map((row) => (
                  <div key={row.label} className="flex h-full min-w-10 flex-1 flex-col items-center justify-end gap-2">
                    <span className="font-mono text-[10px] text-white/35">{row.pageViews}</span>
                    <div
                      className="w-full max-w-12 rounded-t-md bg-white/55"
                      style={{ height: `${Math.max(3, (row.pageViews / maxTrend) * 100)}%` }}
                      title={`${dateLabel(row.label)}: ${row.pageViews} page views`}
                    />
                    <span className="whitespace-nowrap text-[9px] text-white/28">{dateLabel(row.label)}</span>
                  </div>
                ))}
                {trend.length === 0 ? <p className="m-auto text-sm text-white/30">Traffic data will appear after visits are recorded.</p> : null}
              </div>
            </section>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Breakdown title="Top pages" rows={data.pages} />
              <Breakdown title="Traffic sources" rows={data.referrers} empty="Direct traffic or no referrer data yet." />
              <Breakdown title="Devices" rows={data.devices} />
              <Breakdown title="Countries" rows={data.countries} />
              <Breakdown title="Browsers" rows={data.browsers} />
            </div>
          </>
        ) : null}

        {!error && loading && !data ? <p className="py-24 text-center text-sm text-white/35">Loading website analytics…</p> : null}
      </div>
    </main>
  );
}
