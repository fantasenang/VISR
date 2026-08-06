import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin/auth";
import { verifyQrisClaim } from "@/lib/admin/qris";

const schema = z.object({
  orderNumber: z.string().trim().regex(/^VISR\.B\d{2}\.\d{8}\.\d{3,}$/),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return json(
      { error: { code: "ADMIN_SESSION_REQUIRED", message: "Admin session has expired." } },
      401,
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json(
      { error: { code: "INVALID_ORDER", message: "The QRIS order number is invalid." } },
      400,
    );
  }

  try {
    const result = await verifyQrisClaim(parsed.data.orderNumber);
    return json({
      verified: true,
      alreadyPaid: Boolean(result && "alreadyPaid" in result && result.alreadyPaid),
      orderNumber: parsed.data.orderNumber,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "QRIS_ADMIN_VERIFY_FAILED",
      orderNumber: parsed.data.orderNumber,
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    }));
    return json(
      {
        error: {
          code: "QRIS_VERIFICATION_FAILED",
          message: "Payment verification was not applied. Refresh the queue and check the order status.",
        },
      },
      409,
    );
  }
}
