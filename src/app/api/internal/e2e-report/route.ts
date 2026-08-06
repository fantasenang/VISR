import { NextResponse } from "next/server";

const SIMULATOR_SECRET = "visr-e2e-20260806-link-40174";
const PROOF_BUCKET = "qris-payment-proofs";

type ReportInput = {
  secret?: string;
  passed?: boolean;
  orderNumber?: string;
  email?: string;
  customerName?: string;
  steps?: Array<{ name?: string; status?: string; detail?: string }>;
  browserErrors?: string[];
  failedRequests?: string[];
  cleanupRequested?: boolean;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_NOT_CONFIGURED");
  return { url, key };
}

function headers(key: string, prefer?: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function telegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return { sent: false, reason: "not_configured" };
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`TELEGRAM_REPORT_FAILED:${response.status}:${(await response.text()).slice(0, 240)}`);
  return { sent: true };
}

async function cleanup(orderNumber: string, email: string) {
  const { url, key } = config();
  const orderRead = await fetch(
    `${url}/rest/v1/orders?select=id,order_number,email,payment_status,payment_expires_at&order_number=eq.${encodeURIComponent(orderNumber)}&email=eq.${encodeURIComponent(email)}&limit=1`,
    { headers: headers(key), cache: "no-store" },
  );
  if (!orderRead.ok) throw new Error(`ORDER_READ_FAILED:${orderRead.status}`);
  const order = ((await orderRead.json()) as Array<{ id: string; order_number: string; email: string; payment_status: string; payment_expires_at: string }>)[0];
  if (!order) return { status: "not_found" };
  if (order.payment_status === "paid") return { status: "refused_paid_order" };

  const proofRead = await fetch(
    `${url}/rest/v1/qris_payment_proofs?select=id,storage_path&order_id=eq.${encodeURIComponent(order.id)}`,
    { headers: headers(key), cache: "no-store" },
  );
  const proofs = proofRead.ok ? (await proofRead.json()) as Array<{ id: string; storage_path: string }> : [];

  const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const orderPatch = await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`, {
    method: "PATCH",
    headers: headers(key, "return=minimal"),
    body: JSON.stringify({ payment_expires_at: past, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!orderPatch.ok) throw new Error(`ORDER_EXPIRE_FAILED:${orderPatch.status}`);

  const reservationPatch = await fetch(
    `${url}/rest/v1/inventory_reservations?order_id=eq.${encodeURIComponent(order.id)}&status=eq.active`,
    {
      method: "PATCH",
      headers: headers(key, "return=minimal"),
      body: JSON.stringify({ expires_at: past, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!reservationPatch.ok) throw new Error(`RESERVATION_EXPIRE_FAILED:${reservationPatch.status}`);

  const release = await fetch(`${url}/rest/v1/rpc/release_expired_visr_reservations`, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({}),
    cache: "no-store",
  });
  if (!release.ok) throw new Error(`RELEASE_RPC_FAILED:${release.status}:${(await release.text()).slice(0, 180)}`);

  for (const proof of proofs) {
    await fetch(`${url}/storage/v1/object/${PROOF_BUCKET}/${proof.storage_path.split("/").map(encodeURIComponent).join("/")}`, {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
  }
  if (proofs.length) {
    await fetch(`${url}/rest/v1/qris_payment_proofs?order_id=eq.${encodeURIComponent(order.id)}`, {
      method: "DELETE",
      headers: headers(key, "return=minimal"),
      cache: "no-store",
    });
  }

  const finalRead = await fetch(
    `${url}/rest/v1/orders?select=payment_status,fulfillment_status,payment_expires_at&id=eq.${encodeURIComponent(order.id)}&limit=1`,
    { headers: headers(key), cache: "no-store" },
  );
  const finalOrder = finalRead.ok ? ((await finalRead.json()) as unknown[])[0] : null;
  const reservationRead = await fetch(
    `${url}/rest/v1/inventory_reservations?select=status,expires_at&order_id=eq.${encodeURIComponent(order.id)}`,
    { headers: headers(key), cache: "no-store" },
  );
  const reservations = reservationRead.ok ? await reservationRead.json() : null;
  return { status: "released", finalOrder, reservations, removedProofs: proofs.length };
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "PREVIEW_ONLY" }, { status: 404 });
  }
  const input = (await request.json().catch(() => null)) as ReportInput | null;
  if (!input || input.secret !== SIMULATOR_SECRET) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let cleanupResult: unknown = { status: "not_requested" };
  if (input.cleanupRequested && input.orderNumber && input.email) {
    try {
      cleanupResult = await cleanup(input.orderNumber, input.email);
    } catch (error) {
      cleanupResult = { status: "failed", message: error instanceof Error ? error.message : "UNKNOWN_ERROR" };
    }
  }

  const stepLines = (input.steps ?? []).map((step) => {
    const icon = step.status === "pass" ? "✅" : step.status === "warn" ? "⚠️" : "❌";
    return `${icon} <b>${escapeHtml(step.name || "Step")}</b>${step.detail ? `\n${escapeHtml(step.detail).slice(0, 700)}` : ""}`;
  });
  const browserErrors = (input.browserErrors ?? []).slice(0, 8);
  const failedRequests = (input.failedRequests ?? []).slice(0, 8);
  const cleanupText = escapeHtml(JSON.stringify(cleanupResult)).slice(0, 1400);
  const text = [
    `<b>${input.passed ? "✅ VISR E2E SIMULATOR PASSED" : "❌ VISR E2E SIMULATOR FAILED"}</b>`,
    "",
    `<b>Scenario</b>\n1× VISR Link → 40174`,
    input.orderNumber ? `\n<b>Order</b>\n<code>${escapeHtml(input.orderNumber)}</code>` : "",
    "",
    ...stepLines,
    browserErrors.length ? `\n<b>Browser errors</b>\n${browserErrors.map(escapeHtml).join("\n")}` : "",
    failedRequests.length ? `\n<b>Failed requests</b>\n${failedRequests.map(escapeHtml).join("\n")}` : "",
    `\n<b>Cleanup</b>\n<code>${cleanupText}</code>`,
  ].filter(Boolean).join("\n");

  let notification: unknown;
  try {
    notification = await telegram(text);
  } catch (error) {
    notification = { sent: false, error: error instanceof Error ? error.message : "UNKNOWN_ERROR" };
  }

  return NextResponse.json({ ok: true, cleanupResult, notification }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
