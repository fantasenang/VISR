import "server-only";

type ManualPaymentResult = {
  order_id: string;
  order_number: string;
  already_paid: boolean;
  finalized_reservations: number;
  current_status: string;
  recorded_amount_idr: number;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("MANUAL_PAYMENT_NOT_CONFIGURED");
  return { url, serviceRoleKey };
}

export async function verifyManualPayment(input: {
  orderId: string;
  amountIdr: number;
  reference?: string | null;
}) {
  const { url, serviceRoleKey } = config();
  const response = await fetch(`${url}/rest/v1/rpc/verify_manual_payment`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_order_id: input.orderId,
      p_amount_idr: input.amountIdr,
      p_reference: input.reference?.trim() || null,
      p_verified_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const failure = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const message = typeof failure.message === "string" ? failure.message : "MANUAL_PAYMENT_VERIFICATION_FAILED";
    throw new Error(message);
  }

  const payload = (await response.json()) as ManualPaymentResult[] | ManualPaymentResult;
  const result = Array.isArray(payload) ? payload[0] : payload;
  if (!result?.order_id || result.current_status !== "paid") {
    throw new Error("MANUAL_PAYMENT_INVALID_RESPONSE");
  }

  console.info(JSON.stringify({
    event: "ADMIN_MANUAL_PAYMENT_VERIFIED",
    orderId: result.order_id,
    orderNumber: result.order_number,
    alreadyPaid: result.already_paid,
    finalizedReservations: result.finalized_reservations,
    recordedAmountIdr: result.recorded_amount_idr,
    timestamp: new Date().toISOString(),
  }));

  return {
    orderId: result.order_id,
    orderNumber: result.order_number,
    alreadyPaid: result.already_paid,
    finalizedReservations: result.finalized_reservations,
    paymentStatus: result.current_status,
    recordedAmountIdr: result.recorded_amount_idr,
  };
}
