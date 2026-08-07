import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin/auth";
import { verifyManualPayment } from "@/lib/admin/manual-payment";

const orderPattern = /^VISR\.B\d{2}\.\d{8}\.\d{3,}$/;

const requestSchema = z.object({
  orderNumber: z.string().trim().regex(orderPattern),
  amountIdr: z.number().int().positive().max(2_000_000_000),
  reference: z.string().trim().max(200).nullable().optional(),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return json({ error: { code: "ADMIN_UNAUTHORIZED", message: "Sign in to VISR Control." } }, 401);
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json(
      { error: { code: "INVALID_MANUAL_PAYMENT", message: "Check the order number and received amount." } },
      400,
    );
  }

  try {
    const result = await verifyManualPayment(parsed.data);
    return json({ ok: true, payment: result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "MANUAL_PAYMENT_VERIFICATION_FAILED";
    const status = code === "ORDER_NOT_FOUND"
      ? 404
      : [
          "ORDER_NOT_PENDING",
          "MANUAL_PAYMENT_AMOUNT_MISMATCH",
          "MANUAL_PAYMENT_RESERVATION_NOT_ACTIVE",
          "MANUAL_PAYMENT_STOCK_INVARIANT_FAILED",
          "MANUAL_PAYMENT_RESERVATION_MISSING",
        ].includes(code)
        ? 409
        : 502;
    const message = code === "ORDER_NOT_FOUND"
      ? "Order not found."
      : code === "ORDER_NOT_PENDING"
        ? "Order is no longer pending payment. Refresh and check its latest status."
        : code === "MANUAL_PAYMENT_AMOUNT_MISMATCH"
          ? "The received amount does not match the order total or its allowed QRIS unique code."
          : code.includes("STOCK") || code.includes("RESERVATION")
            ? "Payment was not recorded because the stock reservation is not safe to finalize."
            : "Manual payment could not be verified.";

    return json({ error: { code, message } }, status);
  }
}
