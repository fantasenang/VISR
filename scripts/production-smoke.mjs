const baseUrl = (process.env.VISR_BASE_URL ?? "https://visr.works").replace(/\/$/, "");

const checks = [
  {
    name: "health",
    path: "/api/health",
    method: "GET",
    expectedStatus: 200,
    validate: (body) => body?.status === "ok" && body?.checks?.configuration === "ok",
  },
  {
    name: "checkout",
    path: "/checkout",
    method: "GET",
    expectedStatus: 200,
    validateText: (body) => body.includes("Complete your Batch 2 reservation"),
  },
  {
    name: "invalid order lookup",
    path: "/api/orders/lookup",
    method: "POST",
    body: {},
    expectedStatus: 404,
    validate: (body) => body?.error === "ORDER_NOT_FOUND",
  },
  {
    name: "invalid Snap request",
    path: "/api/payments/snap",
    method: "POST",
    body: {},
    expectedStatus: 400,
    validate: (body) => body?.error === "INVALID_PAYMENT_REQUEST",
  },
  {
    name: "invalid reservation",
    path: "/api/orders",
    method: "POST",
    body: {},
    expectedStatus: 400,
    validate: (body) => body?.code === "INVALID_ORDER",
  },
];

let failed = 0;

for (const check of checks) {
  const response = await fetch(`${baseUrl}${check.path}`, {
    method: check.method,
    headers: check.body ? { "content-type": "application/json" } : undefined,
    body: check.body ? JSON.stringify(check.body) : undefined,
    redirect: "manual",
  });

  const raw = await response.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
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
  const passed = statusOk && bodyOk && requestIdOk;

  console.log(
    JSON.stringify({
      check: check.name,
      passed,
      status: response.status,
      expectedStatus: check.expectedStatus,
      requestId: response.headers.get("x-request-id"),
    }),
  );

  if (!passed) failed += 1;
}

if (failed > 0) {
  console.error(`${failed} production smoke check(s) failed.`);
  process.exit(1);
}

console.log("All production smoke checks passed.");
