import { NextResponse } from "next/server";
import { z } from "zod";
import { consumePaymentAccess } from "@/lib/commerce/payment-access";
import { signQrisOrder } from "@/lib/commerce/qris-manual";

const schema = z.object({ orderId: z.string().uuid() });

type OrderRow = {
  id: string;
  order_number: string;
  payment_status: string;
  payment_expires_at: string;
};

function configuration() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("QRIS_NOT_CONFIGURED");
  return { url, serviceRoleKey };
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_ORDER_ACCESS", message: "Order access is not valid." } },
      { status: 400 },
    );
  }

  try {
    const access = await consumePaymentAccess(parsed.data.orderId);
    if (!access.allowed) {
      return NextResponse.json(
        { error: { code: "PAYMENT_ACCESS_REQUIRED", message: "This payment link is invalid or has expired." } },
        { status: 401 },
      );
    }

    const { url, serviceRoleKey } = configuration();
    const response = await fetch(
      `${url}/rest/v1/orders?select=id,order_number,payment_status,payment_expires_at&id=eq.${encodeURIComponent(parsed.data.orderId)}&limit=1`,
      {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error("QRIS_ORDER_LOOKUP_FAILED");
    const order = ((await response.json()) as OrderRow[])[0];
    if (!order) {
      return NextResponse.json(
        { error: { code: "ORDER_NOT_FOUND", message: "Order could not be found." } },
        { status: 404 },
      );
    }
    if (order.payment_status === "paid") {
      return NextResponse.json(
        { error: { code: "ORDER_ALREADY_PAID", message: "This order is already paid." } },
        { status: 409 },
      );
    }
    if (order.payment_status !== "pending" || new Date(order.payment_expires_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: { code: "ORDER_EXPIRED", message: "This payment reservation has expired." } },
        { status: 409 },
      );
    }

    const token = signQrisOrder(order.order_number, order.payment_expires_at);
    const redirectUrl = `/checkout/qris?order_number=${encodeURIComponent(order.order_number)}&token=${encodeURIComponent(token)}`;
    return NextResponse.json({ redirectUrl }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error(JSON.stringify({
      event: "QRIS_SESSION_FAILED",
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    }));
    return NextResponse.json(
      { error: { code: "QRIS_SESSION_FAILED", message: "QRIS payment could not be opened." } },
      { status: 502 },
    );
  }
}
