import { NextResponse } from "next/server";
import { sanitizePaymentProofImage } from "@/lib/commerce/image-sanitizer";
import {
  QRIS_PAYMENT_PROOF_MAX_BYTES,
  QRIS_PAYMENT_PROOF_MIME_TYPES,
  qrisProofAuthHeaders,
  qrisProofConfig,
  qrisProofJsonHeaders,
  qrisProofStorageUrl,
  validQrisProofSignature,
  type QrisPaymentProofRow,
} from "@/lib/commerce/qris-payment-proof";
import { verifyQrisOrderToken } from "@/lib/commerce/qris-manual";

const ORDER_PATTERN = /^VISR\.B\d{2}\.\d{8}\.\d{3,}$/;
const PROOF_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

type OrderRow = {
  id: string;
  order_number: string;
  payment_status: string;
  payment_expires_at: string;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return json({ error: { code: "INVALID_UPLOAD", message: "Payment proof could not be read." } }, 400);
  }

  const orderNumber = String(formData.get("orderNumber") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const proof = formData.get("proof");

  if (!ORDER_PATTERN.test(orderNumber) || !verifyQrisOrderToken(orderNumber, token)) {
    return json({ error: { code: "INVALID_QRIS_SESSION", message: "QRIS payment session is not valid." } }, 401);
  }
  if (!(proof instanceof File)) {
    return json({ error: { code: "PROOF_REQUIRED", message: "Upload your payment proof first." } }, 400);
  }
  if (!QRIS_PAYMENT_PROOF_MIME_TYPES.has(proof.type)) {
    return json({ error: { code: "INVALID_PROOF_TYPE", message: "Use a JPG or PNG image." } }, 415);
  }
  if (proof.size < 1 || proof.size > QRIS_PAYMENT_PROOF_MAX_BYTES) {
    return json({ error: { code: "INVALID_PROOF_SIZE", message: "Payment proof must be 4 MB or smaller." } }, 413);
  }

  const originalBytes = new Uint8Array(await proof.arrayBuffer());
  if (!validQrisProofSignature(originalBytes, proof.type)) {
    return json({ error: { code: "INVALID_PROOF_FILE", message: "The uploaded file is not a valid image." } }, 415);
  }

  let sanitized: Awaited<ReturnType<typeof sanitizePaymentProofImage>>;
  try {
    sanitized = await sanitizePaymentProofImage(originalBytes, proof.name);
  } catch (error) {
    console.warn(JSON.stringify({
      event: "QRIS_PAYMENT_PROOF_SANITIZATION_REJECTED",
      orderNumber,
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    }));
    return json(
      { error: { code: "INVALID_PROOF_IMAGE", message: "The image could not be safely processed. Use a normal JPG or PNG screenshot." } },
      415,
    );
  }

  const { url, serviceRoleKey } = qrisProofConfig();

  try {
    const orderResponse = await fetch(
      `${url}/rest/v1/orders?select=id,order_number,payment_status,payment_expires_at&order_number=eq.${encodeURIComponent(orderNumber)}&limit=1`,
      { headers: qrisProofJsonHeaders(serviceRoleKey), cache: "no-store" },
    );
    if (!orderResponse.ok) throw new Error("QRIS_PROOF_ORDER_READ_FAILED");
    const order = ((await orderResponse.json()) as OrderRow[])[0];
    if (!order) return json({ error: { code: "ORDER_NOT_FOUND", message: "Order could not be found." } }, 404);
    if (order.payment_status !== "pending" || new Date(order.payment_expires_at).getTime() <= Date.now()) {
      return json({ error: { code: "ORDER_EXPIRED", message: "The payment reservation has expired." } }, 409);
    }

    const storageExtension = sanitized.mimeType === "image/png" ? "png" : "jpg";
    const storagePath = `${order.id}/proof.${storageExtension}`;
    const uploadArrayBuffer = new ArrayBuffer(sanitized.bytes.byteLength);
    new Uint8Array(uploadArrayBuffer).set(sanitized.bytes);
    const uploadBody = new FormData();
    uploadBody.append("cacheControl", "0");
    uploadBody.append("", new Blob([uploadArrayBuffer], { type: sanitized.mimeType }), sanitized.fileName);

    const storageResponse = await fetch(qrisProofStorageUrl(url, storagePath), {
      method: "POST",
      headers: {
        ...qrisProofAuthHeaders(serviceRoleKey),
        "x-upsert": "true",
      },
      body: uploadBody,
      cache: "no-store",
    });
    if (!storageResponse.ok) {
      const failure = await storageResponse.text().catch(() => "");
      throw new Error(`QRIS_PROOF_STORAGE_WRITE_FAILED:${storageResponse.status}:${failure.slice(0, 200)}`);
    }

    const uploadedAt = new Date().toISOString();
    const deleteAfter = new Date(Date.now() + PROOF_RETENTION_MS).toISOString();
    const proofResponse = await fetch(`${url}/rest/v1/qris_payment_proofs?on_conflict=order_id`, {
      method: "POST",
      headers: qrisProofJsonHeaders(serviceRoleKey, "resolution=merge-duplicates,return=representation"),
      body: JSON.stringify({
        order_id: order.id,
        storage_path: storagePath,
        original_name: sanitized.fileName,
        mime_type: sanitized.mimeType,
        byte_size: sanitized.bytes.byteLength,
        uploaded_at: uploadedAt,
        used_at: null,
        sanitized_at: uploadedAt,
        pixel_width: sanitized.width,
        pixel_height: sanitized.height,
        content_sha256: sanitized.sha256,
        delete_after: deleteAfter,
        updated_at: uploadedAt,
      }),
      cache: "no-store",
    });
    if (!proofResponse.ok) throw new Error("QRIS_PROOF_RECORD_WRITE_FAILED");
    const savedProof = ((await proofResponse.json()) as QrisPaymentProofRow[])[0];
    if (!savedProof) throw new Error("QRIS_PROOF_RECORD_MISSING");

    console.info(JSON.stringify({
      event: "QRIS_PAYMENT_PROOF_SANITIZED_AND_UPLOADED",
      orderId: order.id,
      orderNumber: order.order_number,
      proofId: savedProof.id,
      originalMimeType: proof.type,
      originalByteSize: proof.size,
      storedMimeType: sanitized.mimeType,
      storedByteSize: sanitized.bytes.byteLength,
      pixelWidth: sanitized.width,
      pixelHeight: sanitized.height,
      contentSha256: sanitized.sha256,
      deleteAfter,
      uploadedAt,
    }));

    return json({ uploaded: true, proofId: savedProof.id, fileName: savedProof.original_name });
  } catch (error) {
    console.error(JSON.stringify({
      event: "QRIS_PAYMENT_PROOF_UPLOAD_FAILED",
      orderNumber,
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    }));
    return json(
      { error: { code: "PROOF_UPLOAD_FAILED", message: "Payment proof could not be uploaded. Try again." } },
      502,
    );
  }
}
