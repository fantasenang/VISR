import { calculateShippingDiscount } from "@/lib/shipping";

const BASE_URL = "https://rajaongkir.komerce.id/api/v1";

export type RajaOngkirDestination = {
  id: number;
  label: string;
  provinceName: string;
  cityName: string;
  districtName: string;
  subdistrictName: string;
  zipCode: string;
};

export type RajaOngkirRate = {
  courierName: string;
  courierCode: string;
  service: string;
  description: string;
  costIdr: number;
  originalCostIdr: number;
  discountIdr: number;
  etd: string;
};

type ApiEnvelope<T> = {
  meta?: {
    message?: string;
    code?: number;
    status?: string;
  };
  data?: T;
};

function getApiKey() {
  const apiKey = process.env.RAJAONGKIR_API_KEY;
  if (!apiKey) throw new Error("RAJAONGKIR_NOT_CONFIGURED");
  return apiKey;
}

async function readJson<T>(response: Response, operation: string): Promise<T> {
  const raw = await response.text();
  let payload: T | null = null;

  try {
    payload = raw ? (JSON.parse(raw) as T) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload) {
    console.error("RAJAONGKIR_API_ERROR", {
      operation,
      status: response.status,
      statusText: response.statusText,
      response: raw.slice(0, 2000),
    });

    if (response.status === 429) throw new Error("RAJAONGKIR_RATE_LIMITED");
    if (response.status === 401 || response.status === 403) throw new Error("RAJAONGKIR_AUTH_FAILED");
    throw new Error("RAJAONGKIR_REQUEST_FAILED");
  }

  return payload;
}

export async function searchDomesticDestinations(search: string, limit = 8) {
  const url = new URL(`${BASE_URL}/destination/domestic-destination`);
  url.searchParams.set("search", search);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", "0");

  const response = await fetch(url, {
    headers: { key: getApiKey() },
    next: { revalidate: 86_400 },
  });

  const payload = await readJson<ApiEnvelope<Array<{
    id: number;
    label: string;
    province_name: string;
    city_name: string;
    district_name: string;
    subdistrict_name: string;
    zip_code: string;
  }>>>(response, "destination-search");

  return (payload.data ?? []).map((item) => ({
    id: Number(item.id),
    label: item.label,
    provinceName: item.province_name,
    cityName: item.city_name,
    districtName: item.district_name,
    subdistrictName: item.subdistrict_name,
    zipCode: item.zip_code,
  })) satisfies RajaOngkirDestination[];
}

export async function calculateDomesticRates(input: {
  originId: number;
  destinationId: number;
  weightGrams: number;
  couriers: string[];
}) {
  const body = new URLSearchParams({
    origin: String(input.originId),
    destination: String(input.destinationId),
    weight: String(Math.max(1, Math.ceil(input.weightGrams))),
    courier: input.couriers.join(":"),
  });

  const response = await fetch(`${BASE_URL}/calculate/domestic-cost`, {
    method: "POST",
    headers: {
      key: getApiKey(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const payload = await readJson<ApiEnvelope<Array<{
    name: string;
    code: string;
    service: string;
    description: string;
    cost: number;
    etd: string;
  }>>>(response, "domestic-rate");

  return (payload.data ?? []).map((item) => {
    const shipping = calculateShippingDiscount(Number(item.cost));

    return {
      courierName: item.name,
      courierCode: item.code.toLowerCase(),
      service: item.service.toUpperCase(),
      description: item.description,
      costIdr: shipping.payableCostIdr,
      originalCostIdr: shipping.quotedCostIdr,
      discountIdr: shipping.discountIdr,
      etd: item.etd,
    };
  }) satisfies RajaOngkirRate[];
}
