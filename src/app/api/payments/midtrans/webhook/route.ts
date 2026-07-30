import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

const notificationSchema = z.object({
  order_id: z.string().min(1).max(100),
  status_code: z.string().min(1).max(10),
  gross_amount: z.string().min(1).max(32),
  signature_key: z.string().length(128),
  transaction_id: z.string().min(1).max(100).optional(),
  transaction_status: z.string().min(1).max(50),
  fraud_status: z.string().max(50).optional(),
});

type OrderRow = {
  id: string;
  order_number: string;
  total_idr: number;
  payment_status: string;
};

type MidtransStatusResponse = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  transaction_id?: string;
  transaction_status?: string;
  fraud_status?: string;
  status_message?: string;
};

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseGrossAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && Number.isInteger(amount) && amount >= 0 ? amount : null;
}

function normalizePaymentStatus(transactionStatus: string, fraudStatus?: string) {
  if (transactionStatus === "settlement") return "paid" as const;
  if (transactionStatus === "capture" && fraudStatus === "accept") return "paid" as const;
  if (["expire", "cancel", "deny"].includes(transactionStatus)) return "expired" as const;
  return "pending" as const;
}

export async function POST(request: Request) {
  const parsed = notificationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    console.warn("MIDTRANS_WEBHOOK_INVALID_BODY", {
      issues: parsed.error.issues.map((issue) => issue.path.join(".")),
    });
    return NextResponse.json({ error: "INVALID_NOTIFICATION" }, { status: 400 });
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

  if (!serverKey || !supabaseUrl || !serviceRoleKey) {
    console.error("MIDTRANS_WEBHOOK_CONFIGURATION_ERROR", {
      hasServerKey: Boolean(serverKey),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      environment: isProduction ? "production" : "sandbox",
    });
    return NextResponse.json({ error: "PAYMENT_NOT_CONFIGURED" }, { status: 503 });
  }

  const payload = parsed.data;
  const expectedSignature = createHash("sha512")
    .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`)
    .digest("hex");

  if (!secureEqual(expectedSignature, payload.signature_key.toLowerCase())) {
    console.warn("MIDTRANS_WEBHOOK_INVALID_SIGNATURE", {
      orderNumber: payload.order_id,
      transactionId: payload.transaction_id ?? null,
    });
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  const databaseHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  const orderResponse = await fetch(
    `${supabaseUrl}/rest/v1/orders?order_number=eq.${encodeURIComponent(payload.order_id)}&select=id,order_number,total_idr,payment_status&limit=1`,
    { headers: databaseHeaders, cache: "no-store" },
  );

  if (!orderResponse.ok) {
    console.error("MIDTRANS_WEBHOOK_ORDER_LOOKUP_ERROR", {
      orderNumber: payload.order_id,
      status: orderResponse.status,
    });
    return NextResponse.json({ error: "ORDER_LOOKUP_FAILED" }, { status: 502 });
  }

  const orders = (await orderResponse.json()) as OrderRow[];
  const order = orders[0];
  if (!order) {
    console.warn("MIDTRANS_WEBHOOK_ORDER_NOT_FOUND", { orderNumber: payload.order_id });
    return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  }

  const notifiedAmount = parseGrossAmount(payload.gross_amount);
  if (notifiedAmount === null || notifiedAmount !== order.total_idr) {
    console.error("MIDTRANS_WEBHOOK_AMOUNT_MISMATCH", {
      orderNumber: payload.order_id,
      expectedAmount: order.total_idr,
      notifiedAmount: payload.gross_amount,
    });
    return NextResponse.json({ error: "AMOUNT_MISMATCH" }, { status: 409 });
  }

  const statusBaseUrl = isProduction
    ? "https://api.midtrans.com/v2"
    : "https://api.sandbox.midtrans.com/v2";
  const statusResponse = await fetch(`${statusBaseUrl}/${encodeURIComponent(payload.order_id)}/status`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  let verifiedStatus: MidtransStatusResponse = {};
  try {
    verifiedStatus = (await statusResponse.json()) as MidtransStatusResponse;
  } catch {
    verifiedStatus = {};
  }

  if (!statusResponse.ok || !verifiedStatus.transaction_status) {
    console.error("MIDTRANS_STATUS_VERIFICATION_FAILED", {
      environment: isProduction ? "production" : "sandbox",
      orderNumber: payload.order_id,
      status: statusResponse.status,
      statusMessage: verifiedStatus.status_message ?? null,
    });
    return NextResponse.json({ error: "STATUS_VERIFICATION_FAILED" }, { status: 502 });
  }

  const verifiedAmount = verifiedStatus.gross_amount
    ? parseGrossAmount(verifiedStatus.gross_amount)
    : null;
  if (
    verifiedStatus.order_id !== order.order_number ||
    verifiedAmount === null ||
    verifiedAmount !== order.total_idr
  ) {
    console.error("MIDTRANS_STATUS_DATA_MISMATCH", {
      expectedOrderNumber: order.order_number,
      verifiedOrderNumber: verifiedStatus.order_id ?? null,
      expectedAmount: order.total_idr,
      verifiedAmount: verifiedStatus.gross_amount ?? null,
    });
    return NextResponse.json({ error: "STATUS_DATA_MISMATCH" }, { status: 409 });
  }

  const normalizedStatus = normalizePaymentStatus(
    verifiedStatus.transaction_status,
    verifiedStatus.fraud_status,
  );

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_midtrans_notification`, {
    method: "POST",
    headers: {
      ...databaseHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_order_number: order.order_number,
      p_payment_status: normalizedStatus,
      p_provider_transaction_id:
        verifiedStatus.transaction_id ?? payload.transaction_id ?? null,
      p_provider_status: verifiedStatus.transaction_status,
      p_raw_payload: {
        notification: payload,
        verified_status: verifiedStatus,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const failure = await response.text().catch(() => "");
    console.error("MIDTRANS_WEBHOOK_UPDATE_FAILED", {
      orderNumber: order.order_number,
      transactionId: verifiedStatus.transaction_id ?? payload.transaction_id ?? null,
      providerStatus: verifiedStatus.transaction_status,
      normalizedStatus,
      databaseStatus: response.status,
      response: failure.slice(0, 1000),
    });
    return NextResponse.json({ error: "PAYMENT_UPDATE_FAILED" }, { status: 502 });
  }

  console.info("MIDTRANS_WEBHOOK_APPLIED", {
    orderNumber: order.order_number,
    transactionId: verifiedStatus.transaction_id ?? payload.transaction_id ?? null,
    previousStatus: order.payment_status,
    providerStatus: verifiedStatus.transaction_status,
    normalizedStatus,
  });

  return NextResponse.json({ received: true });
}
