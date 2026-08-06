import { NextResponse } from "next/server";
import { z } from "zod";
import { signQrisOrder } from "@/lib/commerce/qris-manual";

const schema = z.object({
  orderNumber: z.string().trim().regex(/^VISR\.B\d{2}\.\d{8}\.\d{3,}$/),
});

type OrderRow = {
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
      { error: { code: "INVALID_ORDER_NUMBER", message: "Order number is not valid." } },
      { status: 400 },
    );
  }

  try {
    const { url, serviceRoleKey } = configuration();
    const response = await fetch(
      `${url}/rest/v1/orders?select=order_number,payment_status,payment_expires_at&order_number=eq.${encodeURIComponent(parsed.data.orderNumber)}&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
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

    const token = signQrisOrder(order.order_number);
    const redirectUrl = `/checkout/qris?order_number=${encodeURIComponent(order.order_number)}&token=${encodeURIComponent(token)}`;

    return NextResponse.json(
      { redirectUrl },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
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
