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

export function apiError(
  requestId: string,
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
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

    const text = new TextDecoder().decode(bytes);
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
    return {
      error: {
        code: typeof candidate.code === "string" ? candidate.code : fallbackCode,
        message: typeof candidate.message === "string" ? candidate.message : fallbackMessage,
        ...(candidate.details === undefined ? {} : { details: candidate.details }),
      },
      requestId,
    };
  }

  const code = typeof body.code === "string"
    ? body.code
    : typeof rawError === "string" && /^[A-Z0-9_]+$/.test(rawError)
      ? rawError
      : fallbackCode;
  const message = typeof rawError === "string" && rawError !== code
    ? rawError
    : fallbackMessage;

  return {
    error: {
      code,
      message,
      ...(body.details === undefined ? {} : { details: body.details }),
    },
    requestId,
  };
}
