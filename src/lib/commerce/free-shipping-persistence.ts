type SupabaseHeaders = Record<string, string>;

type PendingOrderRecord = {
  subtotal_idr: number;
  payment_status: string;
  payment_expires_at: string;
};

type PersistenceInput = {
  supabaseUrl: string;
  headers: SupabaseHeaders;
  orderId: string;
  courier: string;
  service: string;
  actualWeightGrams: number;
  boxCount: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type FreeShippingPersistenceResult = {
  shipping_cost_idr: number;
  total_idr: number;
};

async function readFailure(response: Response) {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const code = typeof payload.code === "string" ? payload.code : null;
  const message = typeof payload.message === "string" ? payload.message : null;
  const details = typeof payload.details === "string" ? payload.details : null;
  return { status: response.status, code, message, details };
}

async function patchRows(
  supabaseUrl: string,
  headers: SupabaseHeaders,
  table: string,
  query: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const failure = await readFailure(response);
    throw new Error(`${table.toUpperCase()}_PATCH_FAILED:${JSON.stringify(failure)}`);
  }

  const rows = await response.json().catch(() => []) as unknown[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${table.toUpperCase()}_PATCH_EMPTY`);
  }
}

export async function rollbackPendingOrder(
  supabaseUrl: string,
  headers: SupabaseHeaders,
  orderId: string,
) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&payment_status=eq.pending`,
    {
      method: "DELETE",
      headers: {
        ...headers,
        Prefer: "return=minimal",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const failure = await readFailure(response);
    throw new Error(`ORDER_ROLLBACK_FAILED:${JSON.stringify(failure)}`);
  }
}

export async function persistFreeShipping(
  input: PersistenceInput,
): Promise<FreeShippingPersistenceResult> {
  const orderResponse = await fetch(
    `${input.supabaseUrl}/rest/v1/orders?select=subtotal_idr,payment_status,payment_expires_at&id=eq.${encodeURIComponent(input.orderId)}&limit=1`,
    {
      headers: input.headers,
      cache: "no-store",
    },
  );

  if (!orderResponse.ok) {
    const failure = await readFailure(orderResponse);
    throw new Error(`ORDER_READ_FAILED:${JSON.stringify(failure)}`);
  }

  const rows = await orderResponse.json().catch(() => []) as PendingOrderRecord[];
  const order = rows[0];
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.payment_status !== "pending") throw new Error("ORDER_NOT_PENDING");
  if (!Number.isFinite(order.subtotal_idr) || order.subtotal_idr < 0) {
    throw new Error("INVALID_ORDER_SUBTOTAL");
  }
  if (!order.payment_expires_at || Date.parse(order.payment_expires_at) <= Date.now()) {
    throw new Error("ORDER_EXPIRED");
  }

  const updatedAt = new Date().toISOString();
  const orderQuery = `id=eq.${encodeURIComponent(input.orderId)}&payment_status=eq.pending`;
  await patchRows(input.supabaseUrl, input.headers, "orders", orderQuery, {
    shipping_cost_idr: 0,
    total_weight_grams: input.actualWeightGrams,
    box_count: input.boxCount,
    package_length_cm: input.lengthCm,
    package_width_cm: input.widthCm,
    package_height_cm: input.heightCm,
    updated_at: updatedAt,
  });

  await patchRows(
    input.supabaseUrl,
    input.headers,
    "payments",
    `order_id=eq.${encodeURIComponent(input.orderId)}`,
    {
      amount_idr: order.subtotal_idr,
      updated_at: updatedAt,
    },
  );

  await patchRows(
    input.supabaseUrl,
    input.headers,
    "shipments",
    `order_id=eq.${encodeURIComponent(input.orderId)}`,
    {
      courier: input.courier.trim().toUpperCase(),
      service: input.service.trim().toUpperCase(),
      shipping_cost_idr: 0,
      updated_at: updatedAt,
    },
  );

  return {
    shipping_cost_idr: 0,
    total_idr: order.subtotal_idr,
  };
}
