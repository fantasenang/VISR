import { createHash } from "node:crypto";

const DEFAULT_PIXEL_ID = "1558889889220021";
const DEFAULT_GRAPH_API_VERSION = "v25.0";
const META_REQUEST_TIMEOUT_MS = 8_000;

export type MetaPurchaseItem = {
  sku: string;
  quantity: number;
  unitPriceIdr: number;
};

export type MetaPurchaseOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  whatsapp: string;
  province: string;
  city: string;
  postalCode: string;
  totalIdr: number;
  items: MetaPurchaseItem[];
};

type MetaApiResponse = {
  events_received?: number;
  messages?: string[];
  fbtrace_id?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export type MetaPurchaseResult =
  | { sent: true; eventsReceived: number; traceId: string | null; testEvent: boolean }
  | { sent: false; reason: "not_configured" };

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function hashedArray(value: string) {
  return value ? [sha256(value)] : undefined;
}

function buildUserData(order: MetaPurchaseOrder) {
  const { firstName, lastName } = splitName(order.customerName);
  const email = normalizeEmail(order.email);
  const phone = normalizePhone(order.whatsapp);
  const city = normalizeText(order.city);
  const province = normalizeText(order.province);
  const postalCode = order.postalCode.replace(/\s/g, "");

  return {
    em: hashedArray(email),
    ph: hashedArray(phone),
    fn: hashedArray(normalizeText(firstName)),
    ln: hashedArray(normalizeText(lastName)),
    ct: hashedArray(city),
    st: hashedArray(province),
    zp: hashedArray(postalCode),
    country: hashedArray("id"),
    external_id: hashedArray(order.id),
  };
}

export async function sendMetaPurchaseEvent(order: MetaPurchaseOrder): Promise<MetaPurchaseResult> {
  const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN?.trim();
  if (!accessToken) return { sent: false, reason: "not_configured" };

  const pixelId = process.env.META_PIXEL_ID?.trim() || DEFAULT_PIXEL_ID;
  const apiVersion = process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION;
  const testEventCode = process.env.META_CONVERSIONS_API_TEST_EVENT_CODE?.trim();
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://visr.works").replace(/\/$/, "");
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: `${baseUrl}/checkout`,
        event_id: order.orderNumber,
        action_source: "website",
        user_data: buildUserData(order),
        custom_data: {
          currency: "IDR",
          value: order.totalIdr,
          order_id: order.orderNumber,
          content_name: "VISR Carry — Batch 2",
          content_category: "Diecast display system",
          content_type: "product",
          content_ids: order.items.map((item) => item.sku),
          contents: order.items.map((item) => ({
            id: item.sku,
            quantity: item.quantity,
            item_price: item.unitPriceIdr,
          })),
          num_items: itemCount,
        },
      },
    ],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), META_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      },
    );

    const result = (await response.json().catch(() => ({}))) as MetaApiResponse;
    if (!response.ok || result.error) {
      const code = result.error?.code ?? response.status;
      const subcode = result.error?.error_subcode ?? 0;
      const type = result.error?.type ?? "META_API_ERROR";
      throw new Error(`${type}:${code}:${subcode}`);
    }

    return {
      sent: true,
      eventsReceived: result.events_received ?? 0,
      traceId: result.fbtrace_id ?? null,
      testEvent: Boolean(testEventCode),
    };
  } finally {
    clearTimeout(timeout);
  }
}
