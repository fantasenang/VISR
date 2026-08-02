import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";

const PROJECT_ID = process.env.VERCEL_ANALYTICS_PROJECT_ID?.trim() || "prj_drkQWz5kP1C3HkgMikfyBBRYVrGb";
const TEAM_ID = process.env.VERCEL_ANALYTICS_TEAM_ID?.trim() || "team_tGUNel9cLgGbw2gHzSzuaqZp";
const API_ROOT = "https://api.vercel.com/v1/query/web-analytics";
const allowedRanges = new Set([1, 7, 30, 90]);
const DAY_MS = 86_400_000;
const REQUEST_TIMEOUT_MS = 8_000;

type UnknownRecord = Record<string, unknown>;

type AnalyticsRow = {
  label: string;
  pageViews: number;
  visitors: number | null;
};

type QueryScope = "visits" | "events";
type QueryPath = "count" | "aggregate";

type QueryInput = {
  since: string;
  until: string;
  by?: string;
  limit?: number;
  filter?: string;
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

  if (depth >= 4) return null;
  for (const nested of Object.values(record)) {
    if (!asRecord(nested)) continue;
    const found = readNumberDeep(nested, candidates, depth + 1);
    if (found !== null) return found;
  }

  return null;
}

function pageViews(record: UnknownRecord | null) {
  return (
    readNumberDeep(record, ["pageviews", "pageViews", "page_views", "count", "visits", "value", "total"]) ?? 0
  );
}

function visitors(record: UnknownRecord | null) {
  return readNumberDeep(record, ["visitors", "uniqueVisitors", "unique_visitors", "unique", "users"]);
}

function labelFor(record: UnknownRecord, dimension: string) {
  const leaf = dimension.split("/").at(-1) ?? dimension;
  const candidates = [
    dimension,
    leaf,
    dimension === "day" ? "timestamp" : "",
    dimension === "day" ? "date" : "",
    dimension.startsWith("eventData/") ? "eventData" : "",
  ].filter(Boolean);

  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "Unknown";
}

function normalizeRows(payload: unknown, dimension: string): AnalyticsRow[] {
  return rowsFrom(payload)
    .map((row) => ({
      label: labelFor(row, dimension),
      pageViews: pageViews(row),
      visitors: visitors(row),
    }))
    .filter((row) => row.pageViews > 0 || (row.visitors ?? 0) > 0)
    .sort((left, right) => right.pageViews - left.pageViews);
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

async function optionalQuery(token: string, scope: QueryScope, path: QueryPath, input: QueryInput) {
  try {
    return await queryVercel(token, scope, path, input);
  } catch {
    return null;
  }
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
  const untilMs = Date.now();
  const until = new Date(untilMs).toISOString();
  const since = days === 1 ? jakartaStartOfToday() : new Date(untilMs - days * DAY_MS).toISOString();
  const durationMs = Math.max(1, untilMs - new Date(since).getTime());
  const previousUntil = since;
  const previousSince = new Date(new Date(since).getTime() - durationMs).toISOString();

  try {
    const [
      totalPayload,
      todayPayload,
      previousPayload,
      trendPayload,
      pagesPayload,
      referrersPayload,
      devicesPayload,
      countriesPayload,
      browsersPayload,
      osPayload,
      utmSourcesPayload,
      utmMediumsPayload,
      utmCampaignsPayload,
      eventsPayload,
      sectionsPayload,
      ctaActionsPayload,
      supportActionsPayload,
      checkoutStepsPayload,
    ] = await Promise.all([
      queryVercel(token, "visits", "count", { since, until }),
      optionalQuery(token, "visits", "count", { since: jakartaStartOfToday(), until }),
      optionalQuery(token, "visits", "count", { since: previousSince, until: previousUntil }),
      optionalQuery(token, "visits", "aggregate", { since, until, by: "day", limit: Math.min(days + 2, 92) }),
      optionalQuery(token, "visits", "aggregate", { since, until, by: "requestPath", limit: 12 }),
      optionalQuery(token, "visits", "aggregate", { since, until, by: "referrerHostname", limit: 12 }),
      optionalQuery(token, "visits", "aggregate", { since, until, by: "deviceType", limit: 10 }),
      optionalQuery(token, "visits", "aggregate", { since, until, by: "country", limit: 12 }),
      optionalQuery(token, "visits", "aggregate", { since, until, by: "browserName", limit: 10 }),
      optionalQuery(token, "visits", "aggregate", { since, until, by: "osName", limit: 10 }),
      optionalQuery(token, "visits", "aggregate", { since, until, by: "utmSource", limit: 12 }),
      optionalQuery(token, "visits", "aggregate", { since, until, by: "utmMedium", limit: 12 }),
      optionalQuery(token, "visits", "aggregate", { since, until, by: "utmCampaign", limit: 12 }),
      optionalQuery(token, "events", "aggregate", { since, until, by: "eventName", limit: 20 }),
      optionalQuery(token, "events", "aggregate", {
        since,
        until,
        by: "eventData/section",
        filter: "eventName eq 'Section viewed'",
        limit: 12,
      }),
      optionalQuery(token, "events", "aggregate", {
        since,
        until,
        by: "eventData/action",
        filter: "eventName eq 'CTA clicked'",
        limit: 12,
      }),
      optionalQuery(token, "events", "aggregate", {
        since,
        until,
        by: "eventData/action",
        filter: "eventName eq 'Support clicked'",
        limit: 12,
      }),
      optionalQuery(token, "events", "aggregate", {
        since,
        until,
        by: "eventData/step",
        filter: "eventName eq 'Checkout step'",
        limit: 10,
      }),
    ]);

    const trend = normalizeRows(trendPayload, "day").sort(
      (left, right) => new Date(left.label).getTime() - new Date(right.label).getTime(),
    );
    const pages = normalizeRows(pagesPayload, "requestPath");
    const total = countMetrics(totalPayload);
    const today = countMetrics(todayPayload);
    const previous = countMetrics(previousPayload);

    const aggregateFallback = Math.max(sumPageViews(trend), sumPageViews(pages));
    const totalPageViews = total.pageViews > 0 ? total.pageViews : aggregateFallback;
    const totalVisitors =
      total.visitors !== null && total.visitors > 0
        ? total.visitors
        : bestVisitorFallback(pages) ?? bestVisitorFallback(trend) ?? (totalPageViews === 0 ? 0 : null);
    const todayPageViews = days === 1 && today.pageViews === 0 ? totalPageViews : today.pageViews;
    const todayVisitors =
      days === 1 && (today.visitors === null || today.visitors === 0) ? totalVisitors : today.visitors;

    return NextResponse.json(
      {
        range: { days, since, until, previousSince, previousUntil },
        summary: {
          pageViews: totalPageViews,
          visitors: totalVisitors,
          todayPageViews,
          todayVisitors,
          viewsPerVisitor:
            totalVisitors && totalVisitors > 0 ? Number((totalPageViews / totalVisitors).toFixed(2)) : null,
          previousPageViews: previous.pageViews,
          previousVisitors: previous.visitors,
          pageViewsChange: percentChange(totalPageViews, previous.pageViews),
          visitorsChange: percentChange(totalVisitors, previous.visitors),
        },
        trend,
        pages,
        referrers: normalizeRows(referrersPayload, "referrerHostname"),
        devices: normalizeRows(devicesPayload, "deviceType"),
        countries: normalizeRows(countriesPayload, "country"),
        browsers: normalizeRows(browsersPayload, "browserName"),
        operatingSystems: normalizeRows(osPayload, "osName"),
        utmSources: normalizeRows(utmSourcesPayload, "utmSource"),
        utmMediums: normalizeRows(utmMediumsPayload, "utmMedium"),
        utmCampaigns: normalizeRows(utmCampaignsPayload, "utmCampaign"),
        behavior: {
          events: normalizeRows(eventsPayload, "eventName"),
          sections: normalizeRows(sectionsPayload, "eventData/section"),
          actions: mergeRows(
            normalizeRows(ctaActionsPayload, "eventData/action"),
            normalizeRows(supportActionsPayload, "eventData/action"),
          ),
          checkoutSteps: normalizeRows(checkoutStepsPayload, "eventData/step"),
        },
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "ADMIN_ANALYTICS_FAILED",
        message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        timestamp: new Date().toISOString(),
      }),
    );
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
