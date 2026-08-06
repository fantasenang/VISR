import type { Metadata } from "next";
import QrisPaymentClient from "./qris-payment-client";
import {
  qrisPaymentAmount,
  qrisUniqueCode,
  verifyQrisOrderToken,
} from "@/lib/commerce/qris-manual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Complete Payment — QRIS",
  description: "Complete your VISR reservation using BCA QRIS.",
  robots: { index: false, follow: false },
};

type OrderRow = {
  order_number: string;
  total_idr: number;
  payment_status: string;
  payment_expires_at: string;
};

function ErrorScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="flex min-h-screen items-center bg-[#030303] px-6 py-16 text-white">
      <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.025] p-8 md:p-12">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">VISR / BCA QRIS</p>
        <h1 className="mt-5 text-4xl tracking-[-0.05em]">{title}</h1>
        <p className="mt-6 text-sm leading-7 text-white/50">{detail}</p>
        <a href="/checkout" className="mt-9 inline-flex rounded-full border border-white/15 px-6 py-3 text-sm transition hover:bg-white hover:text-black">Return to checkout</a>
      </div>
    </main>
  );
}

export default async function QrisPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ order_number?: string; token?: string }>;
}) {
  const params = await searchParams;
  const orderNumber = params.order_number?.trim() ?? "";
  const token = params.token?.trim() ?? "";

  if (!orderNumber || !verifyQrisOrderToken(orderNumber, token)) {
    return <ErrorScreen title="Payment link is not valid." detail="Return to checkout and open QRIS from your confirmed reservation." />;
  }

  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return <ErrorScreen title="QRIS is temporarily unavailable." detail="The payment service is not configured. Your reservation has not been changed." />;
  }

  const response = await fetch(
    `${url}/rest/v1/orders?select=order_number,total_idr,payment_status,payment_expires_at&order_number=eq.${encodeURIComponent(orderNumber)}&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return <ErrorScreen title="Order could not be loaded." detail="Refresh this page or return to checkout. Your payment status has not been changed." />;
  }

  const order = ((await response.json()) as OrderRow[])[0];
  if (!order) {
    return <ErrorScreen title="Order could not be found." detail="Check the reservation number and open the payment page again from checkout." />;
  }
  if (order.payment_status === "paid") {
    return <ErrorScreen title="Payment is already verified." detail="This reservation has been secured. Open Track My VISR to view the latest order status." />;
  }
  if (order.payment_status !== "pending" || new Date(order.payment_expires_at).getTime() <= Date.now()) {
    return <ErrorScreen title="Payment reservation has expired." detail="Return to checkout and create a new reservation if stock is still available." />;
  }

  return (
    <QrisPaymentClient
      orderNumber={order.order_number}
      totalIdr={order.total_idr}
      paymentAmountIdr={qrisPaymentAmount(order.total_idr, order.order_number)}
      uniqueCode={qrisUniqueCode(order.order_number)}
      paymentExpiresAt={order.payment_expires_at}
      token={token}
    />
  );
}
