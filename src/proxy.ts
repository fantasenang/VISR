import { NextResponse, type NextRequest } from "next/server";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function resolveRequestId(request: NextRequest) {
  const incoming = request.headers.get("x-request-id")?.trim();
  if (incoming && REQUEST_ID_PATTERN.test(incoming)) return incoming;
  return crypto.randomUUID();
}

export function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
