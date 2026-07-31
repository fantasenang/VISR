const baseUrl = (process.env.VISR_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://visr.works").replace(/\/$/, "");
const origin = new URL(baseUrl).origin;

const checks = [
  {
    name: "health",
    path: "/api/health",
    method: "GET",
    expectedStatus: 200,
    validate: (body) => body?.status === "ok" && body?.checks?.configuration === "ok",
  },
  {
    name: "readiness",
    path: "/api/ready",
    method: "GET",
    expectedStatus: 200,
    validate: (body) => body?.status === "ready" && body?.checks?.database === "ok" && body?.checks?.schema === "ok",
  },
  {
    name: "homepage",
    path: "/",
    method: "GET",
    expectedStatus: 200,
    validateText: (body) => body.length > 500 && /VISR/i.test(body),
  },
  {
    name: "checkout",
    path: "/checkout",
    method: "GET",
    expectedStatus: 200,
    validateText: (body) => /checkout|reservation|preorder/i.test(body),
  },
  {
    name: "invalid Snap request",
    path: "/api/payments/snap",
    method: "POST",
    body: {},
    expectedStatus: 400,
    validate: (body) => body?.error?.code === "INVALID_PAYMENT_REQUEST",
  },
  {
    name: "invalid reservation",
    path: "/api/orders",
    method: "POST",
    body: {},
    expectedStatus: 400,
    validate: (body) => body?.error?.code === "INVALID_ORDER" || body?.error?.code === "INVALID_ORDER_REQUEST",
  },
];

let failed = 0;

for (const check of checks) {
  const startedAt = performance.now();
  let response;
  let raw = "";
  let json = null;

  try {
    response = await fetch(`${baseUrl}${check.path}`, {
      method: check.method,
      headers: check.body
        ? { "content-type": "application/json", origin }
        : { origin },
      body: check.body ? JSON.stringify(check.body) : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    raw = await response.text();
    try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
  } catch (error) {
    console.error(JSON.stringify({
      check: check.name,
      passed: false,
      error: error instanceof Error ? error.message : "request_failed",
      durationMs: Math.round(performance.now() - startedAt),
    }));
    failed += 1;
    continue;
  }

  const statusOk = response.status === check.expectedStatus;
  const bodyOk = check.validate
    ? check.validate(json)
    : check.validateText
      ? check.validateText(raw)
      : true;
  const requestIdOk = check.path.startsWith("/api/")
    ? Boolean(response.headers.get("x-request-id"))
    : true;
  const noStoreOk = check.path.startsWith("/api/")
    ? /no-store/i.test(response.headers.get("cache-control") ?? "")
    : true;
  const passed = statusOk && bodyOk && requestIdOk && noStoreOk;

  console.log(JSON.stringify({
    check: check.name,
    passed,
    status: response.status,
    expectedStatus: check.expectedStatus,
    requestId: response.headers.get("x-request-id"),
    durationMs: Math.round(performance.now() - startedAt),
  }));

  if (!passed) failed += 1;
}

if (failed > 0) {
  console.error(`${failed} production smoke check(s) failed.`);
  process.exit(1);
}

console.log("All production smoke checks passed.");
