import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin/auth";
import { updateAdminOrder } from "@/lib/admin/data";

const fulfillmentStatuses = ["pending", "confirmed", "production", "qc", "packing", "shipped", "delivered"] as const;

const updateSchema = z.object({
  id: z.string().uuid(),
  fulfillmentStatus: z.enum(fulfillmentStatuses),
  trackingNumber: z.string().trim().max(100).nullable(),
});

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "ADMIN_UNAUTHORIZED", message: "Sign in to VISR Control." } },
      { status: 401 },
    );
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_ORDER_UPDATE", message: parsed.error.issues[0]?.message ?? "Check the order update." } },
      { status: 400 },
    );
  }

  try {
    const order = await updateAdminOrder(parsed.data);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ADMIN_ORDER_UPDATE_FAILED";
    return NextResponse.json(
      {
        error: {
          code: message === "ORDER_NOT_FOUND" ? "ORDER_NOT_FOUND" : "ADMIN_ORDER_UPDATE_FAILED",
          message: message === "ORDER_NOT_FOUND" ? "Order not found." : "Order could not be updated.",
        },
      },
      { status: message === "ORDER_NOT_FOUND" ? 404 : 502 },
    );
  }
}
