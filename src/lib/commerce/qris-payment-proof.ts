import "server-only";

export const QRIS_PAYMENT_PROOF_BUCKET = "qris-payment-proofs";
export const QRIS_PAYMENT_PROOF_MAX_BYTES = 4 * 1024 * 1024;
export const QRIS_PAYMENT_PROOF_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export type QrisPaymentProofRow = {
  id: string;
  order_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  byte_size: number;
  uploaded_at: string;
  used_at: string | null;
};

export function qrisProofConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("QRIS_PROOF_NOT_CONFIGURED");
  return { url, serviceRoleKey };
}

export function qrisProofAuthHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

export function qrisProofJsonHeaders(serviceRoleKey: string, prefer?: string) {
  return {
    ...qrisProofAuthHeaders(serviceRoleKey),
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

export function qrisProofStorageUrl(baseUrl: string, storagePath: string, authenticated = false) {
  const encodedPath = storagePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const access = authenticated ? "authenticated/" : "";
  return `${baseUrl}/storage/v1/object/${access}${QRIS_PAYMENT_PROOF_BUCKET}/${encodedPath}`;
}

export async function downloadQrisPaymentProof(storagePath: string) {
  const { url, serviceRoleKey } = qrisProofConfig();
  const response = await fetch(qrisProofStorageUrl(url, storagePath, true), {
    headers: qrisProofAuthHeaders(serviceRoleKey),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`QRIS_PROOF_DOWNLOAD_FAILED:${response.status}`);
  return response;
}

export function validQrisProofSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  return false;
}
