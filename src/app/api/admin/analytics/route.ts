import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";

const PROJECT_ID = process.env.VERCEL_ANALYTICS_PROJECT_ID?.trim() || "prj_drkQWz5kP1C3HkgMikfyBBRYVrGb";
const TEAM_ID = process.env.VERCEL_ANALYTICS_TEAM_ID?.trim() || "team_tGUNel9cLgGbw2gHzSzuaqZp";
const API_BASE = "https://api.vercel.com/v1/query/web-analytics/visits";
const allowedRanges = new Set([1, 7, 30, 90]);

type UnknownRecord = Record<string, unknown>;

type AnalyticsRow = {
  label: string;
  pageViews: number;
  visitors: number | null;
};

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;
}

function rowsFrom(payload: unknown) {
  const record = asRecord(payload);
  const data = record?.data;
  if (Array.isArray(data)) return data.map(asRecord).filter((row): row is UnknownRecord => Boolean(row));
  const single = asRecord(data);
  return single ? [single] : [];
}

function readNumber(record: UnknownRecord | null, candidates: string[]) {
  if (!record) return null;
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }

  const nested = asRecord(record.additionalProperties);
  if (nested) {
    for (const key of candidates) {
      const value = nested[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
    }
  }

  return null;
}

function pageViews(record: UnknownRecord | null) {
  return readNumber(record, ["pageViews", "pageviews", "page_views", "count", "visits", "value"]) ?? 0;
}

function visitors(record: UnknownRecord | null) {
  return readNumber(record, ["visitors", "uniqueVisitors", "unique_visitors", "unique", "users"]);
}

function labelFor(record: UnknownRecord, dimension: string) {
  const candidates = dimension === "day" ? ["timestamp", "day", "date"] : [dimension];
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
    .filter((row) => row.pageViews > 0 || (row.visitors ?? 0) > 0);
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

function analyticsUrl(path: "count" | "aggregate", input: {
  since: string;
  until: string;
  by?: string;
  limit?: number;
}) {
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set("projectId", PROJECT_ID);
  url.searchParams.set("teamId", TEAM_ID);
  url.searchParams.set("since", input.since);
  url.searchParams.set("until", input.until);
  if (input.by) url.searchParams.append("by", input.by);
  if (input.limit) url.searchParams.set("limit", String(input.limit));
  return url;
}

async function queryVercel(token: string, path: "count" | "aggregate", input: {
  since: string;
  until: string;
  by?: string;
  limit?: number;
}) {
  const response = await fetch(analyticsUrl(path, input), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    const error = asRecord(payload)?.error;
    const message = asRecord(error)?.message;
    throw new Error(typeof message === "string" ? message : `VERCEL_ANALYTICS_${response.status}`);
  }
  return payload;
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
  const until = new Date().toISOString();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    const [totalPayload, todayPayload, trendPayload, pagesPayload, referrersPayload, devicesPayload, countriesPayload, browsersPayload] =
      await Promise.all([
        queryVercel(token, "count", { since, until }),
        queryVercel(token, "count", { since: jakartaStartOfToday(), until }),
        queryVercel(token, "aggregate", { since, until, by: "day", limit: Math.min(days + 2, 92) }),
        queryVercel(token, "aggregate", { since, until, by: "requestPath", limit: 8 }),
        queryVercel(token, "aggregate", { since, until, by: "referrerHostname", limit: 8 }),
        queryVercel(token, "aggregate", { since, until, by: "deviceType", limit: 8 }),
        queryVercel(token, "aggregate", { since, until, by: "country", limit: 8 }),
        queryVercel(token, "aggregate", { since, until, by: "browserName", limit: 8 }),
      ]);

    const totalRecord = rowsFrom(totalPayload)[0] ?? asRecord(asRecord(totalPayload)?.data);
    const todayRecord = rowsFrom(todayPayload)[0] ?? asRecord(asRecord(todayPayload)?.data);
    const totalPageViews = pageViews(totalRecord);
    const totalVisitors = visitors(totalRecord);

    return NextResponse.json(
      {
        range: { days, since, until },
        summary: {
          pageViews: totalPageViews,
          visitors: totalVisitors,
          todayPageViews: pageViews(todayRecord),
          todayVisitors: visitors(todayRecord),
          viewsPerVisitor: totalVisitors && totalVisitors > 0 ? Number((totalPageViews / totalVisitors).toFixed(2)) : null,
        },
        trend: normalizeRows(trendPayload, "day"),
        pages: normalizeRows(pagesPayload, "requestPath"),
        referrers: normalizeRows(referrersPayload, "referrerHostname"),
        devices: normalizeRows(devicesPayload, "deviceType"),
        countries: normalizeRows(countriesPayload, "country"),
        browsers: normalizeRows(browsersPayload, "browserName"),
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
