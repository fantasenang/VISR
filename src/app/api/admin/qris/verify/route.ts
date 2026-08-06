import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin/auth";
import { verifyQrisClaim } from "@/lib/admin/qris";

const orderNumberSchema = z.string().trim().regex(/^VISR\.B\d{2}\.\d{8}\.\d{3,}$/);

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.redirect(new URL("/visr-control", request.url), 303);
  }

  const form = await request.formData();
  const parsed = orderNumberSchema.safeParse(form.get("orderNumber"));
  if (!parsed.success) {
    return NextResponse.redirect(new URL("/visr-control/qris?error=invalid_order", request.url), 303);
  }

  try {
    await verifyQrisClaim(parsed.data);
    return NextResponse.redirect(
      new URL(`/visr-control/qris?verified=${encodeURIComponent(parsed.data)}`, request.url),
      303,
    );
  } catch (error) {
    console.error(JSON.stringify({
      event: "QRIS_ADMIN_VERIFY_FAILED",
      orderNumber: parsed.data,
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    }));
    return NextResponse.redirect(new URL("/visr-control/qris?error=verification_failed", request.url), 303);
  }
}
