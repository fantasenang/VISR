import { NextResponse } from "next/server";
import { z } from "zod";

const customerSchema = z.object({
  fullName: z.string().trim().min(3).max(100),
  whatsapp: z.string().regex(/^62\d{8,13}$/),
  email: z.string().email(),
  address: z.string().trim().min(10).max(500),
  province: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  postalCode: z.string().regex(/^\d{5}$/),
  notes: z.string().trim().max(500).optional().default(""),
});

const requestSchema = z.object({
  customer: customerSchema,
  items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() })).min(1).max(8),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_ORDER", details: parsed.error.flatten() }, { status: 400 });
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
    body: JSON.stringify({ customer: parsed.data.customer, requested_items: parsed.data.items }),
    cache: "no-store",
  });

  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    const message = typeof failure.message === "string" ? failure.message : "ORDER_CREATION_FAILED";
    const status = message.includes("OUT_OF_STOCK") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json(await response.json(), { status: 201 });
}
