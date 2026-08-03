"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatRupiah } from "@/lib/commerce/catalog";

const ORDER_ACCESS_STORAGE_KEY = "visr:order-access:v1";

type StoredOrderAccess = {
  orderId: string;
  orderNumber: string;
  contact: string;
  email: string;
  whatsapp: string;
  cancelled?: boolean;
};

type OrderItem = {
  sku: string;
  name: string;
  variant: string | null;
  quantity: number;
  unitPriceIdr: number;
  lineTotalIdr: number;
};

type OrderDetails = {
  orderNumber: string;
  batchCode: string;
  customerName: string;
  subtotalIdr: number;
  shippingCostIdr: number;
  totalIdr: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  paidAt: string | null;
  items: OrderItem[];
};

function apiMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const candidate = payload as { error?: string | { message?: string } };
  if (typeof candidate.error === "string") return candidate.error;
  if (candidate.error && typeof candidate.error.message === "string") return candidate.error.message;
  return fallback;
}

function dateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

function readAccess(expectedOrderNumber: string) {
  try {
    const raw = window.sessionStorage.getItem(ORDER_ACCESS_STORAGE_KEY);
    if (!raw) return null;
    const access = JSON.parse(raw) as StoredOrderAccess;
    if (access.cancelled || access.orderNumber !== expectedOrderNumber || !access.contact) return null;
    return access;
  } catch {
    return null;
  }
}

export function AutoOrderReceipt() {
  const [access, setAccess] = useState<StoredOrderAccess | null>(null);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [error, setError] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const pollCount = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderNumber = (params.get("order_number") ?? "").trim().toUpperCase();
    const autoView = params.get("autoview") === "1" || params.has("payment");
    if (!autoView || !orderNumber) return;
    setAccess(readAccess(orderNumber));
  }, []);

  const loadOrder = async (silent = false) => {
    if (!access || loading) return;
    if (!silent) setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: access.orderNumber,
          contact: access.contact,
        }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(payload, "Order could not be opened."));
      setOrder(payload.order as OrderDetails);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Order could not be opened.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!access) return;
    void loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access]);

  useEffect(() => {
    if (!access || !order || order.paymentStatus !== "pending" || pollCount.current >= 20) return;
    const timer = window.setTimeout(async () => {
      pollCount.current += 1;
      await loadOrder(true);
    }, 2_000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, order?.paymentStatus, pollCount.current]);

  const paymentCopy = useMemo(() => {
    if (!order) return null;
    if (order.paymentStatus === "paid") {
      return {
        eyebrow: "Payment verified",
        title: "Your receipt is ready.",
        body: order.paidAt ? `Verified ${dateTime(order.paidAt)} WIB.` : "Payment has been verified.",
      };
    }
    if (order.paymentStatus === "pending") {
      return {
        eyebrow: "Verifying payment",
        title: "Your order is being confirmed.",
        body: "This page refreshes automatically while Midtrans completes verification.",
      };
    }
    return {
      eyebrow: "Payment status",
      title: order.paymentStatus,
      body: "Open Track My VISR for the latest order status.",
    };
  }, [order]);

  const downloadReceipt = async () => {
    if (!access || !order || order.paymentStatus !== "paid" || downloading) return;
    setDownloading(true);
    setReceiptError("");
    try {
      const response = await fetch("/api/orders/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: order.orderNumber,
          contact: access.contact,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(apiMessage(payload, "Receipt could not be downloaded."));
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/i)?.[1] ?? `VISR-Receipt-${order.orderNumber}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (downloadError) {
      setReceiptError(downloadError instanceof Error ? downloadError.message : "Receipt could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  };

  if (!access) return null;

  return (
    <main className="fixed inset-0 z-[120] overflow-y-auto bg-black text-white">
      <div className="visr-container py-12 md:py-20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="visr-label text-white/45">← Back to exhibition</a>
          <a href="/order" className="visr-label text-white/45">Track another order</a>
        </div>

        <div className="mx-auto max-w-4xl py-16 md:py-24">
          {loading && !order ? (
            <div className="rounded-[2rem] border border-white/12 bg-white/[0.035] p-8 text-white/55">
              Opening your order…
            </div>
          ) : error && !order ? (
            <div className="rounded-[2rem] border border-red-400/30 bg-red-400/10 p-7 text-red-200">
              <p>{error}</p>
              <button type="button" onClick={() => void loadOrder()} className="mt-5 rounded-full bg-white px-5 py-3 text-sm text-black">
                Try again
              </button>
            </div>
          ) : order && paymentCopy ? (
            <>
              <p className="visr-label text-white/42">{paymentCopy.eyebrow}</p>
              <h1 className="mt-5 max-w-[12ch] text-[clamp(3rem,8vw,6.5rem)] font-normal leading-[0.92] tracking-[-0.06em]">
                {paymentCopy.title}
              </h1>
              <p className="mt-7 max-w-xl text-sm leading-7 text-white/50">{paymentCopy.body}</p>

              <section className="mt-12 overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.035]">
                <div className="border-b border-white/10 p-7 md:p-10">
                  <p className="visr-label text-white/40">VISR payment receipt</p>
                  <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
                    <div>
                      <p className="text-sm text-white/40">Order number</p>
                      <p className="mt-2 break-all text-2xl tracking-[-0.03em] md:text-4xl">{order.orderNumber}</p>
                    </div>
                    <span className="rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.14em] text-white/65">
                      {order.paymentStatus}
                    </span>
                  </div>
                </div>

                <div className="p-7 md:p-10">
                  <div className="space-y-5">
                    {order.items.map((item) => (
                      <div key={item.sku} className="flex items-start justify-between gap-5 text-sm">
                        <span className="leading-6 text-white/72">
                          {item.name}{item.variant ? ` — ${item.variant}` : ""} × {item.quantity}
                        </span>
                        <span className="shrink-0 text-white/55">{formatRupiah(item.lineTotalIdr)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 space-y-4 border-t border-white/10 pt-7 text-sm">
                    <div className="flex justify-between gap-5 text-white/55"><span>Subtotal</span><span>{formatRupiah(order.subtotalIdr)}</span></div>
                    <div className="flex justify-between gap-5 text-white/55"><span>Shipping</span><span>{formatRupiah(order.shippingCostIdr)}</span></div>
                    <div className="flex justify-between gap-5 border-t border-white/10 pt-4 text-xl"><span>Total paid</span><span>{formatRupiah(order.totalIdr)}</span></div>
                  </div>

                  {order.paymentStatus === "paid" ? (
                    <button
                      type="button"
                      onClick={downloadReceipt}
                      disabled={downloading}
                      className="mt-8 w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black disabled:opacity-55"
                    >
                      {downloading ? "Preparing PDF…" : "Download Receipt PDF"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void loadOrder()}
                      disabled={loading}
                      className="mt-8 w-full rounded-full border border-white/18 px-6 py-4 text-sm text-white"
                    >
                      {loading ? "Refreshing…" : "Refresh payment status"}
                    </button>
                  )}

                  {receiptError && (
                    <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-200">{receiptError}</div>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
