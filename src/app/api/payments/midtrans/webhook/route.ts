import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

const notificationSchema = z.object({
  order_id: z.string().min(1),
  status_code: z.string().min(1),
  gross_amount: z.string().min(1),
  signature_key: z.string().min(1),
  transaction_id: z.string().optional(),
  transaction_status: z.string().min(1),
  fraud_status: z.string().optional(),
});

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(request: Request) {
  const parsed = notificationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_NOTIFICATION" }, { status: 400 });

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serverKey || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "PAYMENT_NOT_CONFIGURED" }, { status: 503 });
  }

  const payload = parsed.data;
  const expectedSignature = createHash("sha512")
    .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`)
    .digest("hex");

  if (!secureEqual(expectedSignature, payload.signature_key)) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  const isPaid =
    payload.transaction_status === "settlement" ||
    (payload.transaction_status === "capture" && payload.fraud_status === "accept");
  const isExpired = ["expire", "cancel", "deny"].includes(payload.transaction_status);
  const normalizedStatus = isPaid ? "paid" : isExpired ? "expired" : "pending";

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_midtrans_notification`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_order_number: payload.order_id,
      p_payment_status: normalizedStatus,
      p_provider_transaction_id: payload.transaction_id ?? null,
      p_provider_status: payload.transaction_status,
      p_raw_payload: payload,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    return NextResponse.json({ error: "PAYMENT_UPDATE_FAILED", details: failure }, { status: 502 });
  }

  return NextResponse.json({ received: true });
}
