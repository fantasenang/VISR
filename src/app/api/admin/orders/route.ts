import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin/auth";
import { updateAdminOrder } from "@/lib/admin/data";
import { cancelVisrOrder } from "@/lib/admin/order-actions";

const fulfillmentStatuses = ["pending", "confirmed", "production", "qc", "packing", "shipped", "delivered"] as const;

const updateSchema = z.object({
  id: z.string().uuid(),
  fulfillmentStatus: z.enum(fulfillmentStatuses),
  trackingNumber: z.string().trim().max(100).nullable(),
});

function unauthorized() {
  return NextResponse.json(
    { error: { code: "ADMIN_UNAUTHORIZED", message: "Sign in to VISR Control." } },
    { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_ORDER_UPDATE", message: parsed.error.issues[0]?.message ?? "Check the order update." } },
      { status: 400 },
    );
  }

  try {
    const order = await updateAdminOrder(parsed.data);
    return NextResponse.json({ ok: true, order }, { headers: { "Cache-Control": "no-store, max-age=0" } });
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

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const id = new URL(request.url).searchParams.get("id");
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(
      { error: { code: "INVALID_ORDER_ID", message: "Order ID is not valid." } },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    const order = await cancelVisrOrder(parsedId.data);
    return NextResponse.json(
      { ok: true, order },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "ORDER_CANCELLATION_FAILED";
    const status =
      message === "ORDER_NOT_FOUND"
        ? 404
        : ["ORDER_ALREADY_ARCHIVED", "ORDER_NOT_CANCELLABLE", "ORDER_STATUS_CHANGED"].includes(message)
          ? 409
          : 502;
    const responseMessage =
      message === "ORDER_NOT_FOUND"
        ? "Order not found."
        : message === "ORDER_ALREADY_ARCHIVED"
          ? "Order ini sudah berada di arsip."
          : message === "ORDER_STATUS_CHANGED"
            ? "Status order berubah saat pembatalan diproses. Refresh dashboard lalu cek kembali."
            : message === "ORDER_NOT_CANCELLABLE"
              ? "Status pembayaran order ini tidak dapat dibatalkan dari dashboard."
              : "Order could not be cancelled.";

    return NextResponse.json(
      { error: { code: message, message: responseMessage } },
      { status, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
