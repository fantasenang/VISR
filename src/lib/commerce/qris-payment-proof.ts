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
  delete_after?: string;
  sanitized_at?: string | null;
  pixel_width?: number | null;
  pixel_height?: number | null;
  content_sha256?: string | null;
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

export async function purgeExpiredQrisPaymentProofs(limit = 100) {
  const { url, serviceRoleKey } = qrisProofConfig();
  const now = new Date().toISOString();
  const readResponse = await fetch(
    `${url}/rest/v1/qris_payment_proofs?select=id,storage_path&delete_after=lte.${encodeURIComponent(now)}&order=delete_after.asc&limit=${Math.max(1, Math.min(500, limit))}`,
    { headers: qrisProofJsonHeaders(serviceRoleKey), cache: "no-store" },
  );
  if (!readResponse.ok) throw new Error("QRIS_PROOF_RETENTION_READ_FAILED");
  const rows = (await readResponse.json()) as Array<{ id: string; storage_path: string }>;
  if (rows.length === 0) return 0;

  const storageResponse = await fetch(`${url}/storage/v1/object/${QRIS_PAYMENT_PROOF_BUCKET}`, {
    method: "DELETE",
    headers: qrisProofJsonHeaders(serviceRoleKey),
    body: JSON.stringify({ prefixes: rows.map((row) => row.storage_path) }),
    cache: "no-store",
  });
  if (!storageResponse.ok) {
    const failure = await storageResponse.text().catch(() => "");
    throw new Error(`QRIS_PROOF_RETENTION_STORAGE_DELETE_FAILED:${storageResponse.status}:${failure.slice(0, 120)}`);
  }

  const inFilter = `in.(${rows.map((row) => row.id).join(",")})`;
  const databaseResponse = await fetch(
    `${url}/rest/v1/qris_payment_proofs?id=${encodeURIComponent(inFilter)}`,
    {
      method: "DELETE",
      headers: qrisProofJsonHeaders(serviceRoleKey, "return=minimal"),
      cache: "no-store",
    },
  );
  if (!databaseResponse.ok) throw new Error("QRIS_PROOF_RETENTION_RECORD_DELETE_FAILED");
  console.info(JSON.stringify({
    event: "QRIS_PAYMENT_PROOFS_PURGED",
    deleted: rows.length,
    ranAt: now,
  }));
  return rows.length;
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
