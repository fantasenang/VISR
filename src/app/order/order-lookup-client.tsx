"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatRupiah } from "@/lib/commerce/catalog";

type OrderItem = {
  sku: string;
  name: string;
  variant: string | null;
  quantity: number;
  unitPriceIdr: number;
  lineTotalIdr: number;
};

type Shipment = {
  courier: string | null;
  service: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
};

type OrderDetails = {
  orderNumber: string;
  batchCode: string;
  customerName: string;
  email: string;
  whatsapp: string;
  deliveryAddress: {
    address: string;
    province: string;
    city: string;
    postalCode: string;
  };
  subtotalIdr: number;
  shippingCostIdr: number;
  totalIdr: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentExpiresAt: string;
  paidAt: string | null;
  createdAt: string;
  items: OrderItem[];
  shipment: Shipment | null;
};

const timeline = [
  { key: "confirmed", label: "Reservation confirmed" },
  { key: "paid", label: "Payment verified" },
  { key: "production", label: "In production" },
  { key: "qc", label: "Quality inspection" },
  { key: "packing", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
] as const;

const fulfillmentRank: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  production: 2,
  qc: 3,
  packing: 4,
  shipped: 5,
  delivered: 6,
};

function dateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

function paymentLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pending",
    paid: "Verified",
    expired: "Expired",
    failed: "Failed",
    refunded: "Refunded",
  };
  return labels[status] ?? status;
}

export function OrderLookupClient() {
  const [orderNumber, setOrderNumber] = useState("");
  const [contact, setContact] = useState("");
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefilledOrderNumber = params.get("order_number");
    if (prefilledOrderNumber) setOrderNumber(prefilledOrderNumber.toUpperCase());
  }, []);

  const activeRank = useMemo(() => {
    if (!order) return 0;
    if (order.paymentStatus !== "paid") return 0;
    return Math.max(1, fulfillmentRank[order.fulfillmentStatus] ?? 1);
  }, [order]);

  const lookupOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError("");
    setOrder(null);

    try {
      const response = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, contact }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error === "COMMERCE_NOT_CONFIGURED" ? "Order tracking is temporarily unavailable." : "We could not match that order number and contact detail.");
      }

      setOrder(payload.order as OrderDetails);
      window.history.replaceState({}, "", `/order?order_number=${encodeURIComponent(payload.order.orderNumber)}`);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Order tracking is temporarily unavailable.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetLookup = () => {
    setOrder(null);
    setContact("");
    setError("");
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="visr-container py-12 md:py-20">
        <div className="flex items-center justify-between gap-4">
          <a href="/" className="visr-label text-white/45">← Back to exhibition</a>
          {order && <button type="button" onClick={resetLookup} className="visr-label text-white/45 transition hover:text-white">View another order</button>}
        </div>

        {!order ? (
          <div className="mx-auto max-w-3xl py-20 md:py-28">
            <p className="visr-label text-white/42">Guest order access</p>
            <h1 className="mt-5 max-w-[11ch] text-[clamp(3.25rem,8vw,7rem)] font-normal leading-[0.92] tracking-[-0.06em]">Track My VISR.</h1>
            <p className="mt-8 max-w-xl text-sm leading-7 text-white/50">No account or password required. Enter your order number and the email or WhatsApp number used during checkout.</p>

            <form onSubmit={lookupOrder} className="mt-12 rounded-[2rem] border border-white/12 bg-white/[0.035] p-7 md:p-10">
              <label className="block text-sm text-white/65">
                Order number
                <input
                  required
                  autoComplete="off"
                  value={orderNumber}
                  onChange={(event) => setOrderNumber(event.target.value.toUpperCase())}
                  placeholder="VISR.B02.20260730.001"
                  className="mt-3 w-full rounded-2xl border border-white/12 bg-transparent px-4 py-4 text-sm uppercase outline-none transition placeholder:text-white/20 focus:border-white/40"
                />
              </label>

              <label className="mt-6 block text-sm text-white/65">
                Email or WhatsApp
                <input
                  required
                  autoComplete="email"
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="Used during checkout"
                  className="mt-3 w-full rounded-2xl border border-white/12 bg-transparent px-4 py-4 text-sm outline-none transition placeholder:text-white/20 focus:border-white/40"
                />
              </label>

              {error && <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm leading-6 text-red-200">{error}</div>}

              <button type="submit" disabled={isLoading} className="mt-8 w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition hover:bg-white/85 disabled:cursor-wait disabled:opacity-55">
                {isLoading ? "Finding your order…" : "View My Order"}
              </button>
              <p className="mt-5 text-center text-xs leading-5 text-white/30">Your contact detail is only used to verify access to this order.</p>
            </form>
          </div>
        ) : (
          <div className="py-16 md:py-24">
            <p className="visr-label text-white/42">{order.batchCode} order</p>
            <h1 className="mt-5 max-w-full break-words text-[clamp(2rem,5.2vw,4.75rem)] font-normal leading-[1.02] tracking-[-0.045em] [overflow-wrap:anywhere]">{order.orderNumber}</h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/50">This page follows your VISR from reservation through production and delivery.</p>

            <div className="mt-14 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-[2rem] border border-white/12 bg-white/[0.035] p-7 md:p-10">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-7">
                  <div>
                    <p className="visr-label text-white/40">Order status</p>
                    <p className="mt-3 text-2xl">{order.paymentStatus === "paid" ? "Your place in Batch 2 is secured." : paymentLabel(order.paymentStatus)}</p>
                  </div>
                  <span className="rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.14em] text-white/60">Payment {paymentLabel(order.paymentStatus)}</span>
                </div>

                <div className="mt-9 space-y-0">
                  {timeline.map((item, index) => {
                    const completed = index <= activeRank;
                    const current = index === activeRank;
                    return (
                      <div key={item.key} className="grid grid-cols-[24px_1fr] gap-4">
                        <div className="flex flex-col items-center">
                          <span className={`mt-0.5 h-3 w-3 rounded-full border ${completed ? "border-white bg-white" : "border-white/20"}`} />
                          {index < timeline.length - 1 && <span className={`min-h-10 w-px flex-1 ${index < activeRank ? "bg-white/55" : "bg-white/12"}`} />}
                        </div>
                        <div className="pb-8">
                          <p className={completed ? "text-white" : "text-white/30"}>{item.label}</p>
                          {current && <p className="mt-2 text-xs leading-5 text-white/42">Current stage</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <aside className="space-y-6">
                <div className="rounded-[2rem] border border-white/12 bg-white/[0.035] p-7 md:p-9">
                  <p className="visr-label text-white/40">Order details</p>
                  <div className="mt-7 space-y-5">
                    {order.items.map((item) => (
                      <div key={item.sku} className="flex justify-between gap-5 text-sm">
                        <span className="leading-6 text-white/72">{item.name}{item.variant ? ` — ${item.variant}` : ""} × {item.quantity}</span>
                        <span className="shrink-0 text-white/45">{formatRupiah(item.lineTotalIdr)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-7 border-t border-white/10 pt-6 text-sm">
                    <div className="flex justify-between gap-4 text-white/50"><span>Subtotal</span><span>{formatRupiah(order.subtotalIdr)}</span></div>
                    <div className="mt-3 flex justify-between gap-4 text-white/50"><span>Shipping</span><span>{order.shippingCostIdr > 0 ? formatRupiah(order.shippingCostIdr) : "To be confirmed"}</span></div>
                    <div className="mt-5 flex justify-between gap-4 text-lg"><span>Total</span><span>{formatRupiah(order.totalIdr)}</span></div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/12 bg-white/[0.035] p-7 md:p-9">
                  <p className="visr-label text-white/40">Delivery</p>
                  <p className="mt-6 text-lg">{order.customerName}</p>
                  <p className="mt-3 text-sm leading-7 text-white/48">{order.deliveryAddress.address}<br />{order.deliveryAddress.city}, {order.deliveryAddress.province} {order.deliveryAddress.postalCode}</p>
                  <p className="mt-5 text-xs leading-5 text-white/30">Order created {dateTime(order.createdAt)} WIB</p>
                </div>

                {order.shipment?.trackingNumber && (
                  <div className="rounded-[2rem] border border-white/12 bg-white/[0.035] p-7 md:p-9">
                    <p className="visr-label text-white/40">Shipment</p>
                    <p className="mt-6 text-xl">{order.shipment.courier ?? "Courier"}{order.shipment.service ? ` — ${order.shipment.service}` : ""}</p>
                    <p className="mt-4 break-all text-sm text-white/55">{order.shipment.trackingNumber}</p>
                    {order.shipment.shippedAt && <p className="mt-4 text-xs text-white/30">Shipped {dateTime(order.shipment.shippedAt)} WIB</p>}
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
