import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";

const PROJECT_ID = process.env.VERCEL_ANALYTICS_PROJECT_ID?.trim() || "prj_drkQWz5kP1C3HkgMikfyBBRYVrGb";
const TEAM_ID = process.env.VERCEL_ANALYTICS_TEAM_ID?.trim() || "team_tGUNel9cLgGbw2gHzSzuaqZp";
const API_ROOT = "https://api.vercel.com/v1/query/web-analytics";
const allowedRanges = new Set([1, 7, 30, 90]);
const DAY_MS = 86_400_000;
const REQUEST_TIMEOUT_MS = 8_000;
const QUERY_CONCURRENCY = 4;

type UnknownRecord = Record<string, unknown>;
type QueryScope = "visits" | "events";
type QueryPath = "count" | "aggregate";

type QueryInput = {
  since: string;
  until: string;
  by?: string;
  limit?: number;
  filter?: string;
};

type QueryTask = {
  key: string;
  scope: QueryScope;
  path: QueryPath;
  input: QueryInput;
};

type AnalyticsRow = {
  label: string;
  pageViews: number;
  visitors: number | null;
};

type FunnelRow = AnalyticsRow & {
  rateFromVisitors: number | null;
  rateFromPrevious: number | null;
};

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;
}

function rowsFrom(payload: unknown) {
  const record = asRecord(payload);
  const data = record?.data;
  if (Array.isArray(data)) return data.map(asRecord).filter((row): row is UnknownRecord => Boolean(row));

  const dataRecord = asRecord(data);
  if (!dataRecord) return [];

  for (const key of ["rows", "results", "items"]) {
    const nested = dataRecord[key];
    if (Array.isArray(nested)) {
      return nested.map(asRecord).filter((row): row is UnknownRecord => Boolean(row));
    }
  }

  return [dataRecord];
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function readNumberDeep(value: unknown, candidates: string[], depth = 0): number | null {
  const record = asRecord(value);
  if (!record) return null;

  for (const key of candidates) {
    const direct = numericValue(record[key]);
    if (direct !== null) return direct;
  }

  if (depth >= 5) return null;
  for (const nested of Object.values(record)) {
    if (!asRecord(nested)) continue;
    const found = readNumberDeep(nested, candidates, depth + 1);
    if (found !== null) return found;
  }

  return null;
}

function readLabelDeep(value: unknown, candidates: string[], depth = 0): string | null {
  const record = asRecord(value);
  if (!record) return null;

  for (const key of candidates) {
    const direct = record[key];
    if (typeof direct === "string" && direct.trim()) return direct;
    if (typeof direct === "number" && Number.isFinite(direct)) return String(direct);
  }

  if (depth >= 5) return null;
  for (const nested of Object.values(record)) {
    if (!asRecord(nested)) continue;
    const found = readLabelDeep(nested, candidates, depth + 1);
    if (found) return found;
  }

  return null;
}

function pageViews(record: UnknownRecord | null) {
  return readNumberDeep(record, ["pageviews", "pageViews", "page_views", "count", "visits", "value", "total"]) ?? 0;
}

function visitors(record: UnknownRecord | null) {
  return readNumberDeep(record, ["visitors", "uniqueVisitors", "unique_visitors", "unique", "users"]);
}

function labelFor(record: UnknownRecord, dimension: string) {
  const leaf = dimension.split("/").at(-1) ?? dimension;
  return (
    readLabelDeep(record, [
      dimension,
      leaf,
      dimension === "day" ? "timestamp" : "",
      dimension === "day" ? "date" : "",
      dimension.startsWith("eventData/") ? "eventData" : "",
    ].filter(Boolean)) ?? "Unknown"
  );
}

function normalizeRows(payload: unknown, dimension: string): AnalyticsRow[] {
  const merged = new Map<string, AnalyticsRow>();

  for (const row of rowsFrom(payload)) {
    const label = labelFor(row, dimension);
    const count = pageViews(row);
    const unique = visitors(row);
    if (count <= 0 && (unique ?? 0) <= 0) continue;

    const current = merged.get(label);
    merged.set(label, {
      label,
      pageViews: (current?.pageViews ?? 0) + count,
      visitors:
        current?.visitors === null && unique === null
          ? null
          : Math.max(current?.visitors ?? 0, unique ?? 0),
    });
  }

  return [...merged.values()].sort((left, right) => right.pageViews - left.pageViews);
}

function mergeRows(...groups: AnalyticsRow[][]) {
  const merged = new Map<string, AnalyticsRow>();
  for (const rows of groups) {
    for (const row of rows) {
      const current = merged.get(row.label);
      merged.set(row.label, {
        label: row.label,
        pageViews: (current?.pageViews ?? 0) + row.pageViews,
        visitors:
          current?.visitors === null && row.visitors === null
            ? null
            : Math.max(current?.visitors ?? 0, row.visitors ?? 0),
      });
    }
  }
  return [...merged.values()].sort((left, right) => right.pageViews - left.pageViews);
}

function jakartaStartOfToday() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const date = formatter.format(new Date());
  return new Date(`${date}T00:00:00+07:00`).toISOString();
}

function analyticsUrl(scope: QueryScope, path: QueryPath, input: QueryInput) {
  const url = new URL(`${API_ROOT}/${scope}/${path}`);
  url.searchParams.set("projectId", PROJECT_ID);
  url.searchParams.set("teamId", TEAM_ID);
  url.searchParams.set("since", input.since);
  url.searchParams.set("until", input.until);
  if (input.by) url.searchParams.append("by", input.by);
  if (input.limit) url.searchParams.set("limit", String(input.limit));
  if (input.filter) url.searchParams.set("filter", input.filter);
  return url;
}

async function queryVercel(token: string, scope: QueryScope, path: QueryPath, input: QueryInput) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(analyticsUrl(scope, path, input), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok) {
      const error = asRecord(payload)?.error;
      const message = asRecord(error)?.message;
      throw new Error(typeof message === "string" ? message : `VERCEL_ANALYTICS_${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function runOptionalQueries(token: string, tasks: QueryTask[]) {
  const results = new Map<string, unknown>();
  const failures: Array<{ key: string; message: string }> = [];
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      const task = tasks[index];
      try {
        results.set(task.key, await queryVercel(token, task.scope, task.path, task.input));
      } catch (error) {
        failures.push({
          key: task.key,
          message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(QUERY_CONCURRENCY, tasks.length) }, () => worker()));
  return {
    get(key: string) {
      return results.get(key) ?? null;
    },
    failures,
  };
}

function countMetrics(payload: unknown) {
  const record = asRecord(asRecord(payload)?.data) ?? rowsFrom(payload)[0] ?? null;
  return { pageViews: pageViews(record), visitors: visitors(record) };
}

function sumPageViews(rows: AnalyticsRow[]) {
  return rows.reduce((total, row) => total + row.pageViews, 0);
}

function bestVisitorFallback(rows: AnalyticsRow[]) {
  const available = rows.map((row) => row.visitors).filter((value): value is number => value !== null);
  return available.length > 0 ? Math.max(...available) : null;
}

function percentChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function conversionRate(value: number | null, base: number | null) {
  if (value === null || base === null || base <= 0) return null;
  return Number(((value / base) * 100).toFixed(1));
}

function findRow(rows: AnalyticsRow[], label: string) {
  return rows.find((row) => row.label === label) ?? null;
}

function rowMetric(row: AnalyticsRow | null) {
  if (!row) return 0;
  return row.visitors ?? row.pageViews;
}

function buildFunnel(input: {
  totalPageViews: number;
  totalVisitors: number | null;
  events: AnalyticsRow[];
  actions: AnalyticsRow[];
  checkoutSteps: AnalyticsRow[];
}): FunnelRow[] {
  const visitorBase = input.totalVisitors ?? input.totalPageViews;
  const steps: Array<{ label: string; row: AnalyticsRow | null }> = [
    {
      label: "website_visitors",
      row: {
        label: "website_visitors",
        pageViews: input.totalPageViews,
        visitors: input.totalVisitors,
      },
    },
    { label: "preorder_cta", row: findRow(input.actions, "preorder") },
    { label: "checkout_viewed", row: findRow(input.events, "Checkout viewed") },
    { label: "information", row: findRow(input.checkoutSteps, "information") },
    { label: "payment", row: findRow(input.checkoutSteps, "payment") },
  ];

  let previousMetric = visitorBase;
  return steps.map(({ label, row }, index) => {
    const metric = index === 0 ? visitorBase : rowMetric(row);
    const result: FunnelRow = {
      label,
      pageViews: row?.pageViews ?? (index === 0 ? input.totalPageViews : 0),
      visitors: row?.visitors ?? (index === 0 ? input.totalVisitors : null),
      rateFromVisitors: conversionRate(metric, visitorBase),
      rateFromPrevious: index === 0 ? 100 : conversionRate(metric, previousMetric),
    };
    previousMetric = metric;
    return result;
  });
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "ADMIN_UNAUTHORIZED", message: "Sign in to VISR Control." } },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const token = process.env.VERCEL_ACCESS_TOKEN?.trim() || process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      {
        error: {
          code: "VERCEL_ANALYTICS_TOKEN_MISSING",
          message: "Add VERCEL_ACCESS_TOKEN to the Vercel project environment to load analytics inside VISR Control.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const requestedRange = Number(new URL(request.url).searchParams.get("days") ?? 7);
  const days = allowedRanges.has(requestedRange) ? requestedRange : 7;
  const queryDays = days === 90 ? 62 : days;
  const untilMs = Date.now();
  const until = new Date(untilMs).toISOString();
  const since = queryDays === 1 ? jakartaStartOfToday() : new Date(untilMs - queryDays * DAY_MS).toISOString();
  const durationMs = Math.max(1, untilMs - new Date(since).getTime());
  const previousUntil = since;
  const previousSince = new Date(new Date(since).getTime() - durationMs).toISOString();

  try {
    const totalPayload = await queryVercel(token, "visits", "count", { since, until });
    const optional = await runOptionalQueries(token, [
      { key: "today", scope: "visits", path: "count", input: { since: jakartaStartOfToday(), until } },
      { key: "previous", scope: "visits", path: "count", input: { since: previousSince, until: previousUntil } },
      { key: "trend", scope: "visits", path: "aggregate", input: { since, until, by: "day", limit: Math.min(queryDays + 2, 64) } },
      { key: "pages", scope: "visits", path: "aggregate", input: { since, until, by: "requestPath", limit: 15 } },
      { key: "referrers", scope: "visits", path: "aggregate", input: { since, until, by: "referrerHostname", limit: 15 } },
      { key: "devices", scope: "visits", path: "aggregate", input: { since, until, by: "deviceType", limit: 10 } },
      { key: "countries", scope: "visits", path: "aggregate", input: { since, until, by: "country", limit: 15 } },
      { key: "browsers", scope: "visits", path: "aggregate", input: { since, until, by: "browserName", limit: 10 } },
      { key: "os", scope: "visits", path: "aggregate", input: { since, until, by: "osName", limit: 10 } },
      { key: "utmSources", scope: "visits", path: "aggregate", input: { since, until, by: "utmSource", limit: 15 } },
      { key: "utmMediums", scope: "visits", path: "aggregate", input: { since, until, by: "utmMedium", limit: 15 } },
      { key: "utmCampaigns", scope: "visits", path: "aggregate", input: { since, until, by: "utmCampaign", limit: 15 } },
      { key: "events", scope: "events", path: "aggregate", input: { since, until, by: "eventName", limit: 30 } },
      { key: "sections", scope: "events", path: "aggregate", input: { since, until, by: "eventData/section", filter: "eventName eq 'Section viewed'", limit: 15 } },
      { key: "ctaActions", scope: "events", path: "aggregate", input: { since, until, by: "eventData/action", filter: "eventName eq 'CTA clicked'", limit: 15 } },
      { key: "supportActions", scope: "events", path: "aggregate", input: { since, until, by: "eventData/action", filter: "eventName eq 'Support clicked'", limit: 15 } },
      { key: "checkoutSteps", scope: "events", path: "aggregate", input: { since, until, by: "eventData/step", filter: "eventName eq 'Checkout step'", limit: 10 } },
      { key: "landingPages", scope: "events", path: "aggregate", input: { since, until, by: "eventData/landingPath", filter: "eventName eq 'Session started'", limit: 15 } },
      { key: "sourceTypes", scope: "events", path: "aggregate", input: { since, until, by: "eventData/sourceType", filter: "eventName eq 'Session started'", limit: 12 } },
      { key: "viewports", scope: "events", path: "aggregate", input: { since, until, by: "eventData/viewport", filter: "eventName eq 'Session started'", limit: 10 } },
      { key: "orientations", scope: "events", path: "aggregate", input: { since, until, by: "eventData/orientation", filter: "eventName eq 'Session started'", limit: 5 } },
      { key: "visitHours", scope: "events", path: "aggregate", input: { since, until, by: "eventData/hourWib", filter: "eventName eq 'Session started'", limit: 24 } },
      { key: "weekdays", scope: "events", path: "aggregate", input: { since, until, by: "eventData/weekdayWib", filter: "eventName eq 'Session started'", limit: 7 } },
      { key: "scrollDepth", scope: "events", path: "aggregate", input: { since, until, by: "eventData/maxScroll", filter: "eventName eq 'Session summary'", limit: 8 } },
      { key: "engagedTime", scope: "events", path: "aggregate", input: { since, until, by: "eventData/engagedTime", filter: "eventName eq 'Session summary'", limit: 8 } },
      { key: "exitSections", scope: "events", path: "aggregate", input: { since, until, by: "eventData/lastSection", filter: "eventName eq 'Session summary'", limit: 15 } },
      { key: "sectionsSeen", scope: "events", path: "aggregate", input: { since, until, by: "eventData/sectionsSeen", filter: "eventName eq 'Session summary'", limit: 8 } },
      { key: "pageSummaries", scope: "events", path: "aggregate", input: { since, until, by: "eventData/path", filter: "eventName eq 'Session summary'", limit: 15 } },
    ]);

    if (optional.failures.length > 0) {
      console.warn(JSON.stringify({
        event: "ADMIN_ANALYTICS_PARTIAL_DATA",
        failures: optional.failures,
        timestamp: new Date().toISOString(),
      }));
    }

    const trend = normalizeRows(optional.get("trend"), "day").sort(
      (left, right) => new Date(left.label).getTime() - new Date(right.label).getTime(),
    );
    const pages = normalizeRows(optional.get("pages"), "requestPath");
    const total = countMetrics(totalPayload);
    const today = countMetrics(optional.get("today"));
    const previous = countMetrics(optional.get("previous"));

    const aggregateFallback = Math.max(sumPageViews(trend), sumPageViews(pages));
    const totalPageViews = total.pageViews > 0 ? total.pageViews : aggregateFallback;
    const totalVisitors =
      total.visitors !== null && total.visitors > 0
        ? total.visitors
        : bestVisitorFallback(pages) ?? bestVisitorFallback(trend) ?? (totalPageViews === 0 ? 0 : null);
    const todayPageViews = queryDays === 1 && today.pageViews === 0 ? totalPageViews : today.pageViews;
    const todayVisitors = queryDays === 1 && (today.visitors === null || today.visitors === 0) ? totalVisitors : today.visitors;

    const events = normalizeRows(optional.get("events"), "eventName");
    const actions = mergeRows(
      normalizeRows(optional.get("ctaActions"), "eventData/action"),
      normalizeRows(optional.get("supportActions"), "eventData/action"),
    );
    const checkoutSteps = normalizeRows(optional.get("checkoutSteps"), "eventData/step");

    return NextResponse.json(
      {
        range: { days, queryDays, since, until, previousSince, previousUntil },
        summary: {
          pageViews: totalPageViews,
          visitors: totalVisitors,
          todayPageViews,
          todayVisitors,
          viewsPerVisitor: totalVisitors && totalVisitors > 0 ? Number((totalPageViews / totalVisitors).toFixed(2)) : null,
          previousPageViews: previous.pageViews,
          previousVisitors: previous.visitors,
          pageViewsChange: percentChange(totalPageViews, previous.pageViews),
          visitorsChange: percentChange(totalVisitors, previous.visitors),
        },
        trend,
        pages,
        referrers: normalizeRows(optional.get("referrers"), "referrerHostname"),
        devices: normalizeRows(optional.get("devices"), "deviceType"),
        countries: normalizeRows(optional.get("countries"), "country"),
        browsers: normalizeRows(optional.get("browsers"), "browserName"),
        operatingSystems: normalizeRows(optional.get("os"), "osName"),
        utmSources: normalizeRows(optional.get("utmSources"), "utmSource"),
        utmMediums: normalizeRows(optional.get("utmMediums"), "utmMedium"),
        utmCampaigns: normalizeRows(optional.get("utmCampaigns"), "utmCampaign"),
        funnel: buildFunnel({ totalPageViews, totalVisitors, events, actions, checkoutSteps }),
        behavior: {
          events,
          sections: normalizeRows(optional.get("sections"), "eventData/section"),
          actions,
          checkoutSteps,
        },
        sessions: {
          landingPages: normalizeRows(optional.get("landingPages"), "eventData/landingPath"),
          sourceTypes: normalizeRows(optional.get("sourceTypes"), "eventData/sourceType"),
          viewports: normalizeRows(optional.get("viewports"), "eventData/viewport"),
          orientations: normalizeRows(optional.get("orientations"), "eventData/orientation"),
          visitHours: normalizeRows(optional.get("visitHours"), "eventData/hourWib"),
          weekdays: normalizeRows(optional.get("weekdays"), "eventData/weekdayWib"),
          scrollDepth: normalizeRows(optional.get("scrollDepth"), "eventData/maxScroll"),
          engagedTime: normalizeRows(optional.get("engagedTime"), "eventData/engagedTime"),
          exitSections: normalizeRows(optional.get("exitSections"), "eventData/lastSection"),
          sectionsSeen: normalizeRows(optional.get("sectionsSeen"), "eventData/sectionsSeen"),
          pageSummaries: normalizeRows(optional.get("pageSummaries"), "eventData/path"),
        },
        availability: {
          partial: optional.failures.length > 0,
          failedDimensions: optional.failures.map((failure) => failure.key),
        },
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error(JSON.stringify({
      event: "ADMIN_ANALYTICS_FAILED",
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      timestamp: new Date().toISOString(),
    }));
    return NextResponse.json(
      {
        error: {
          code: "ADMIN_ANALYTICS_FAILED",
          message: error instanceof Error ? error.message : "Analytics data could not be loaded.",
        },
      },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
