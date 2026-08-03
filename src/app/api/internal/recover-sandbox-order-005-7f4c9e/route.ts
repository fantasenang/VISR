import { NextResponse } from "next/server";
import { applyPaymentStateFallback } from "@/lib/commerce/payment-state-fallback";

const ORDER_NUMBER = "VISR.B02.20260803.005";
const TRANSACTION_ID = "A120260803041717AIczOhirWOID";
const EXPECTED_TOTAL_IDR = 198000;

type OrderRow = {
  id: string;
  order_number: string;
  payment_status: string;
  total_idr: number;
};

export async function GET() {
  if (process.env.MIDTRANS_IS_PRODUCTION === "true") {
    return NextResponse.json({ error: "SANDBOX_ONLY" }, { status: 404 });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
  const response = await fetch(
    `${supabaseUrl}/rest/v1/orders?select=id,order_number,payment_status,total_idr&order_number=eq.${encodeURIComponent(ORDER_NUMBER)}&limit=1`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) {
    return NextResponse.json({ error: "ORDER_LOOKUP_FAILED" }, { status: 502 });
  }

  const order = ((await response.json()) as OrderRow[])[0];
  if (!order || order.total_idr !== EXPECTED_TOTAL_IDR) {
    return NextResponse.json({ error: "ORDER_NOT_ELIGIBLE" }, { status: 409 });
  }
  if (order.payment_status === "paid") {
    return NextResponse.json({ recovered: true, alreadyPaid: true, orderNumber: ORDER_NUMBER });
  }
  if (order.payment_status !== "pending") {
    return NextResponse.json({ error: "ORDER_NOT_PENDING" }, { status: 409 });
  }

  const result = await applyPaymentStateFallback({
    supabaseUrl,
    serviceRoleKey,
    orderNumber: ORDER_NUMBER,
    paymentStatus: "paid",
    providerTransactionId: TRANSACTION_ID,
    providerStatus: "settlement",
    rawPayload: {
      source: "one_time_sandbox_recovery",
      evidence: "signed_midtrans_settlement_notification",
      recoveredAt: new Date().toISOString(),
    },
  });

  return NextResponse.json(
    { recovered: true, orderNumber: ORDER_NUMBER, result },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
