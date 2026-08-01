import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin/auth";
import { updateAdminProduct } from "@/lib/admin/data";

const updateSchema = z.object({
  sku: z.string().trim().min(3).max(64),
  priceIdr: z.number().int().min(0).max(100_000_000),
  stockTotal: z.number().int().min(0).max(1_000_000),
  maxPerOrder: z.number().int().min(1).max(100),
  isActive: z.boolean(),
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
      { error: { code: "INVALID_PRODUCT_UPDATE", message: parsed.error.issues[0]?.message ?? "Check the product update." } },
      { status: 400 },
    );
  }

  try {
    const product = await updateAdminProduct(parsed.data);
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ADMIN_PRODUCT_UPDATE_FAILED";
    const status = message === "PRODUCT_NOT_FOUND" ? 404 : message === "STOCK_BELOW_COMMITTED" ? 409 : 502;
    const responseMessage =
      message === "PRODUCT_NOT_FOUND"
        ? "Product not found."
        : message === "STOCK_BELOW_COMMITTED"
          ? "Total stock cannot be lower than reserved plus sold stock."
          : "Product could not be updated.";
    return NextResponse.json(
      { error: { code: message, message: responseMessage } },
      { status },
    );
  }
}
