import { NextResponse } from "next/server";

export const MAX_JSON_BODY_BYTES = 64 * 1024;

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
};

const SAFE_ERROR_CODE = /^[A-Z0-9_]{2,80}$/;
const SENSITIVE_ERROR_PATTERN = /postgres|supabase|postgrest|sql|schema|relation|column|constraint|function|stack|trace|authorization|bearer|apikey|api[_-]?key|secret|service[_-]?role|server[_-]?key|signature|environment variable|process\.env|https?:\/\//i;

function safeCode(value: unknown, fallback: string) {
  return typeof value === "string" && SAFE_ERROR_CODE.test(value) ? value : fallback;
}

function safeMessage(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 240 || SENSITIVE_ERROR_PATTERN.test(normalized)) return fallback;
  return normalized;
}

function safeDetails(value: unknown) {
  if (value == null) return undefined;
  // Validation details are safe to expose. Provider/database objects are not.
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  const allowed = ["fieldErrors", "formErrors", "currentCostIdr"];
  const entries = Object.entries(candidate).filter(([key]) => allowed.includes(key));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function apiError(
  requestId: string,
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  const sanitizedDetails = safeDetails(details);
  const body: ApiErrorBody = {
    error: {
      code: safeCode(code, "REQUEST_FAILED"),
      message: safeMessage(message, "The request could not be completed."),
      ...(sanitizedDetails === undefined ? {} : { details: sanitizedDetails }),
    },
    requestId,
  };

  return NextResponse.json(body, {
    status,
    headers: {
      "x-request-id": requestId,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function readJsonBody(request: Request, maximumBytes = MAX_JSON_BODY_BYTES) {
  const reader = request.body?.getReader();
  if (!reader) return { ok: false as const, code: "INVALID_JSON", status: 400 as const };

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        return { ok: false as const, code: "PAYLOAD_TOO_LARGE", status: 413 as const };
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const, code: "INVALID_JSON", status: 400 as const };
  }
}

export function normalizeErrorBody(
  requestId: string,
  body: Record<string, unknown>,
  fallbackCode = "REQUEST_FAILED",
  fallbackMessage = "The request could not be completed.",
): ApiErrorBody {
  const rawError = body.error;
  if (rawError && typeof rawError === "object" && !Array.isArray(rawError)) {
    const candidate = rawError as Record<string, unknown>;
    const details = safeDetails(candidate.details);
    return {
      error: {
        code: safeCode(candidate.code, fallbackCode),
        message: safeMessage(candidate.message, fallbackMessage),
        ...(details === undefined ? {} : { details }),
      },
      requestId,
    };
  }

  const code = safeCode(body.code, typeof rawError === "string" ? safeCode(rawError, fallbackCode) : fallbackCode);
  const details = safeDetails(body.details);
  return {
    error: {
      code,
      message: safeMessage(rawError, fallbackMessage),
      ...(details === undefined ? {} : { details }),
    },
    requestId,
  };
}
