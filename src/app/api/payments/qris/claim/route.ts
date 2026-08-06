import { NextResponse } from "next/server";
import { z } from "zod";
import {
  downloadQrisPaymentProof,
  qrisProofJsonHeaders,
  type QrisPaymentProofRow,
} from "@/lib/commerce/qris-payment-proof";
import {
  QRIS_PROVIDER,
  qrisPaymentAmount,
  qrisUniqueCode,
  verifyQrisOrderToken,
} from "@/lib/commerce/qris-manual";
import { sendTelegramQrisClaim } from "@/lib/notifications/telegram";

const schema = z.object({
  orderNumber: z.string().trim().regex(/^VISR\.B\d{2}\.\d{8}\.\d{3,}$/),
  token: z.string().trim().min(20).max(200),
  proofId: z.string().uuid(),
});

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  total_idr: number;
  payment_status: string;
  payment_expires_at: string;
  notes: string | null;
};

type PaymentRow = { id: string };

function headers(key: string, prefer?: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function invalidSession() {
  return NextResponse.json(
    { error: { code: "INVALID_QRIS_SESSION", message: "QRIS payment session is not valid." } },
    { status: 401 },
  );
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidSession();
  if (!verifyQrisOrderToken(parsed.data.orderNumber, parsed.data.token)) return invalidSession();

  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: { code: "QRIS_NOT_CONFIGURED", message: "QRIS verification is temporarily unavailable." } },
      { status: 503 },
    );
  }

  try {
    const orderResponse = await fetch(
      `${url}/rest/v1/orders?select=id,order_number,customer_name,total_idr,payment_status,payment_expires_at,notes&order_number=eq.${encodeURIComponent(parsed.data.orderNumber)}&limit=1`,
      { headers: headers(serviceRoleKey), cache: "no-store" },
    );
    if (!orderResponse.ok) throw new Error("QRIS_CLAIM_ORDER_READ_FAILED");
    const order = ((await orderResponse.json()) as OrderRow[])[0];
    if (!order) {
      return NextResponse.json(
        { error: { code: "ORDER_NOT_FOUND", message: "Order could not be found." } },
        { status: 404 },
      );
    }
    if (order.payment_status === "paid") {
      return NextResponse.json({ pendingVerification: true, alreadyPaid: true });
    }
    if (order.payment_status !== "pending" || new Date(order.payment_expires_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: { code: "ORDER_EXPIRED", message: "The payment reservation has expired." } },
        { status: 409 },
      );
    }

    const proofResponse = await fetch(
      `${url}/rest/v1/qris_payment_proofs?select=id,order_id,storage_path,original_name,mime_type,byte_size,uploaded_at,used_at&id=eq.${encodeURIComponent(parsed.data.proofId)}&order_id=eq.${encodeURIComponent(order.id)}&used_at=is.null&limit=1`,
      { headers: qrisProofJsonHeaders(serviceRoleKey), cache: "no-store" },
    );
    if (!proofResponse.ok) throw new Error("QRIS_CLAIM_PROOF_READ_FAILED");
    const proof = ((await proofResponse.json()) as QrisPaymentProofRow[])[0];
    if (!proof) {
      return NextResponse.json(
        { error: { code: "PROOF_REQUIRED", message: "Upload your payment proof before submitting." } },
        { status: 409 },
      );
    }

    const proofFile = await downloadQrisPaymentProof(proof.storage_path);
    const proofBytes = await proofFile.arrayBuffer();

    const claimedAt = new Date().toISOString();
    const uniqueCode = qrisUniqueCode(order.order_number);
    const amountIdr = qrisPaymentAmount(order.total_idr, order.order_number);
    const marker = `[QRIS_BCA_CLAIMED:${claimedAt}]`;
    const existingNotes = order.notes?.trim() ?? "";
    const notes = existingNotes.includes("[QRIS_BCA_CLAIMED:")
      ? existingNotes
      : [existingNotes, marker].filter(Boolean).join("\n");
    const currentExpiry = new Date(order.payment_expires_at).getTime();
    const extendedExpiry = new Date(Math.max(currentExpiry, Date.now() + 6 * 60 * 60 * 1000)).toISOString();

    const paymentRead = await fetch(
      `${url}/rest/v1/payments?select=id&order_id=eq.${encodeURIComponent(order.id)}&limit=1`,
      { headers: headers(serviceRoleKey), cache: "no-store" },
    );
    if (!paymentRead.ok) throw new Error("QRIS_CLAIM_PAYMENT_READ_FAILED");
    const payment = ((await paymentRead.json()) as PaymentRow[])[0];
    const paymentBody = {
      provider: QRIS_PROVIDER,
      provider_status: "claimed",
      amount_idr: amountIdr,
      raw_payload: {
        channel: "bca_static_qris",
        order_number: order.order_number,
        order_total_idr: order.total_idr,
        unique_code: uniqueCode,
        expected_amount_idr: amountIdr,
        claimed_at: claimedAt,
        proof_id: proof.id,
        proof_storage_path: proof.storage_path,
        proof_mime_type: proof.mime_type,
      },
      updated_at: claimedAt,
    };

    const paymentWrite = payment
      ? await fetch(`${url}/rest/v1/payments?id=eq.${encodeURIComponent(payment.id)}`, {
          method: "PATCH",
          headers: headers(serviceRoleKey, "return=minimal"),
          body: JSON.stringify(paymentBody),
          cache: "no-store",
        })
      : await fetch(`${url}/rest/v1/payments`, {
          method: "POST",
          headers: headers(serviceRoleKey, "return=minimal"),
          body: JSON.stringify({ order_id: order.id, ...paymentBody }),
          cache: "no-store",
        });
    if (!paymentWrite.ok) throw new Error("QRIS_CLAIM_PAYMENT_WRITE_FAILED");

    const reservationWrite = await fetch(
      `${url}/rest/v1/inventory_reservations?order_id=eq.${encodeURIComponent(order.id)}&status=eq.active`,
      {
        method: "PATCH",
        headers: headers(serviceRoleKey, "return=minimal"),
        body: JSON.stringify({ expires_at: extendedExpiry, updated_at: claimedAt }),
        cache: "no-store",
      },
    );
    if (!reservationWrite.ok) throw new Error("QRIS_CLAIM_RESERVATION_WRITE_FAILED");

    const orderWrite = await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}&payment_status=eq.pending`, {
      method: "PATCH",
      headers: headers(serviceRoleKey, "return=minimal"),
      body: JSON.stringify({
        notes,
        payment_expires_at: extendedExpiry,
        updated_at: claimedAt,
      }),
      cache: "no-store",
    });
    if (!orderWrite.ok) throw new Error("QRIS_CLAIM_ORDER_WRITE_FAILED");

    const proofWrite = await fetch(
      `${url}/rest/v1/qris_payment_proofs?id=eq.${encodeURIComponent(proof.id)}&used_at=is.null`,
      {
        method: "PATCH",
        headers: headers(serviceRoleKey, "return=minimal"),
        body: JSON.stringify({ used_at: claimedAt, updated_at: claimedAt }),
        cache: "no-store",
      },
    );
    if (!proofWrite.ok) {
      console.error(JSON.stringify({
        event: "QRIS_PAYMENT_PROOF_MARK_USED_FAILED",
        orderId: order.id,
        orderNumber: order.order_number,
        proofId: proof.id,
      }));
    }

    console.info(JSON.stringify({
      event: "QRIS_PAYMENT_CLAIMED",
      orderId: order.id,
      orderNumber: order.order_number,
      proofId: proof.id,
      expectedAmountIdr: amountIdr,
      extendedUntil: extendedExpiry,
      claimedAt,
    }));

    try {
      const notification = await sendTelegramQrisClaim({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        expectedAmountIdr: amountIdr,
        uniqueCode,
        claimedAt,
        proof: {
          bytes: proofBytes,
          mimeType: proof.mime_type,
          fileName: proof.original_name,
        },
      });
      console.info(JSON.stringify({
        event: notification.sent ? "TELEGRAM_QRIS_CLAIM_SENT" : "TELEGRAM_QRIS_CLAIM_NOT_CONFIGURED",
        orderId: order.id,
        orderNumber: order.order_number,
      }));
    } catch (notificationError) {
      console.error(JSON.stringify({
        event: "TELEGRAM_QRIS_CLAIM_SEND_FAILED",
        orderId: order.id,
        orderNumber: order.order_number,
        message: notificationError instanceof Error ? notificationError.message : "UNKNOWN_ERROR",
      }));
    }

    return NextResponse.json(
      { pendingVerification: true, extendedUntil: extendedExpiry },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error(JSON.stringify({
      event: "QRIS_CLAIM_FAILED",
      orderNumber: parsed.data.orderNumber,
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    }));
    return NextResponse.json(
      { error: { code: "QRIS_CLAIM_FAILED", message: "Payment confirmation could not be submitted." } },
      { status: 502 },
    );
  }
}
