import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import {
  downloadQrisPaymentProof,
  qrisProofConfig,
  qrisProofJsonHeaders,
  type QrisPaymentProofRow,
} from "@/lib/commerce/qris-payment-proof";

const ORDER_PATTERN = /^VISR\.B\d{2}\.\d{8}\.\d{3,}$/;

type OrderRow = { id: string };

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return json({ error: { code: "ADMIN_SESSION_REQUIRED" } }, 401);

  const orderNumber = new URL(request.url).searchParams.get("orderNumber")?.trim() ?? "";
  if (!ORDER_PATTERN.test(orderNumber)) return json({ error: { code: "INVALID_ORDER" } }, 400);

  const { url, serviceRoleKey } = qrisProofConfig();

  try {
    const orderResponse = await fetch(
      `${url}/rest/v1/orders?select=id&order_number=eq.${encodeURIComponent(orderNumber)}&limit=1`,
      { headers: qrisProofJsonHeaders(serviceRoleKey), cache: "no-store" },
    );
    if (!orderResponse.ok) throw new Error("QRIS_PROOF_ADMIN_ORDER_READ_FAILED");
    const order = ((await orderResponse.json()) as OrderRow[])[0];
    if (!order) return json({ error: { code: "ORDER_NOT_FOUND" } }, 404);

    const proofResponse = await fetch(
      `${url}/rest/v1/qris_payment_proofs?select=id,order_id,storage_path,original_name,mime_type,byte_size,uploaded_at,used_at&order_id=eq.${encodeURIComponent(order.id)}&limit=1`,
      { headers: qrisProofJsonHeaders(serviceRoleKey), cache: "no-store" },
    );
    if (!proofResponse.ok) throw new Error("QRIS_PROOF_ADMIN_RECORD_READ_FAILED");
    const proof = ((await proofResponse.json()) as QrisPaymentProofRow[])[0];
    if (!proof) return json({ error: { code: "PROOF_NOT_FOUND" } }, 404);

    const fileResponse = await downloadQrisPaymentProof(proof.storage_path);
    return new NextResponse(fileResponse.body, {
      status: 200,
      headers: {
        "Content-Type": proof.mime_type,
        "Content-Disposition": `inline; filename="${proof.original_name.replace(/["\\]/g, "_")}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "QRIS_PROOF_ADMIN_READ_FAILED",
      orderNumber,
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    }));
    return json({ error: { code: "PROOF_READ_FAILED" } }, 502);
  }
}
