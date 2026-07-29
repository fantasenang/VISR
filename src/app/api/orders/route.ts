import { NextResponse } from "next/server";
import { reservationSchema } from "@/lib/commerce/order-schema";

type ReservationResult = {
  order_id: string;
  order_number: string;
  expires_at: string;
};

export async function POST(request: Request) {
  const parsed = reservationSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_ORDER", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "COMMERCE_NOT_CONFIGURED" }, { status: 503 });
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/reserve_visr_order`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer: parsed.data.customer,
      requested_items: parsed.data.items,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    const message = typeof failure.message === "string" ? failure.message : "ORDER_CREATION_FAILED";
    const normalized = message.toUpperCase();
    const status = normalized.includes("STOCK") ? 409 : normalized.includes("LIMIT") ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }

  const payload = (await response.json()) as ReservationResult[] | ReservationResult;
  const reservation = Array.isArray(payload) ? payload[0] : payload;

  if (!reservation?.order_number) {
    return NextResponse.json({ error: "INVALID_RESERVATION_RESPONSE" }, { status: 502 });
  }

  return NextResponse.json(
    {
      orderId: reservation.order_id,
      orderNumber: reservation.order_number,
      expiresAt: reservation.expires_at,
    },
    { status: 201 },
  );
}
