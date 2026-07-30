"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type PaymentReturn = "finish" | "pending" | "error";

export function PaymentReturnGateway() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || pathname !== "/checkout") return null;

  const status = searchParams.get("payment") as PaymentReturn | null;
  if (status !== "finish" && status !== "pending" && status !== "error") return null;

  const orderNumber = searchParams.get("order_id") ?? "";
  const orderHref = orderNumber
    ? `/order?order_number=${encodeURIComponent(orderNumber)}`
    : "/order";

  const content = status === "finish"
    ? {
        eyebrow: "Payment received",
        title: "Your place in Batch 2 is secured.",
        body: "Thank you for becoming part of Batch 2. We’ll keep you updated as your VISR moves from production to shipping.",
        note: "Your final payment status is verified server-side. Keep your order number for access from any device.",
      }
    : status === "pending"
      ? {
          eyebrow: "Payment pending",
          title: "Your reservation is still held.",
          body: "Complete the remaining Midtrans instructions before the reservation deadline to secure your place in Batch 2.",
          note: "Bank transfers and selected payment methods may require additional processing time.",
        }
      : {
          eyebrow: "Payment incomplete",
          title: "Your payment was not completed.",
          body: "No successful payment was recorded from this attempt. You can return to checkout while stock remains available.",
          note: "A failed authorization may still appear temporarily in your bank or payment provider.",
        };

  return (
    <main className="fixed inset-0 z-[9999] overflow-y-auto bg-black text-white">
      <div className="visr-container flex min-h-screen flex-col py-12 md:py-20">
        <a href="/" className="visr-label text-white/45">← Back to exhibition</a>

        <div className="my-auto max-w-4xl py-20">
          <p className="visr-label text-white/42">{content.eyebrow}</p>
          <h1 className="mt-5 max-w-[14ch] text-[clamp(3rem,7vw,6rem)] font-normal leading-[0.94] tracking-[-0.055em]">
            {content.title}
          </h1>

          <div className="mt-12 rounded-[2rem] border border-white/12 bg-white/[0.035] p-7 md:p-10">
            {orderNumber && (
              <div>
                <p className="visr-label text-white/40">Order number</p>
                <p className="mt-4 break-all text-2xl tracking-[-0.03em] md:text-4xl">{orderNumber}</p>
              </div>
            )}

            <p className={`${orderNumber ? "mt-8" : ""} max-w-2xl text-sm leading-7 text-white/58`}>
              {content.body}
            </p>
            <p className="mt-6 max-w-2xl text-xs leading-5 text-white/35">{content.note}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={orderHref} className="rounded-full bg-white px-6 py-4 text-center text-sm font-medium !text-black">
                {status === "finish" ? "Track My VISR" : "View Order"}
              </a>
              {status !== "finish" && (
                <a href="/checkout" className="rounded-full border border-white/15 px-6 py-4 text-center text-sm text-white/75">
                  Return to checkout
                </a>
              )}
              <a href="/" className="rounded-full border border-white/15 px-6 py-4 text-center text-sm text-white/75">
                Back to exhibition
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
