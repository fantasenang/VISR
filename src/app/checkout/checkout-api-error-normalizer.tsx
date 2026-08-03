"use client";

import { useEffect } from "react";

type StructuredApiError = {
  error?: unknown;
  requestId?: unknown;
};

function requestPath(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function readableError(payload: StructuredApiError) {
  const error = payload.error;
  if (typeof error === "string") return null;
  if (!error || typeof error !== "object" || Array.isArray(error)) return null;

  const candidate = error as Record<string, unknown>;
  const message = typeof candidate.message === "string" ? candidate.message.trim() : "";
  if (!message) return null;

  return {
    message,
    code: typeof candidate.code === "string" ? candidate.code : undefined,
  };
}

export default function CheckoutApiErrorNormalizer() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      const path = requestPath(input);

      if (response.ok || !path.includes("/api/orders")) return response;

      const payload = (await response.clone().json().catch(() => null)) as StructuredApiError | null;
      if (!payload) return response;

      const readable = readableError(payload);
      if (!readable) return response;

      const headers = new Headers(response.headers);
      headers.set("Content-Type", "application/json; charset=utf-8");

      return new Response(
        JSON.stringify({
          ...payload,
          error: readable.message,
          errorCode: readable.code,
        }),
        {
          status: response.status,
          statusText: response.statusText,
          headers,
        },
      );
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
