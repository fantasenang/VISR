"use client";

import { useEffect, useState } from "react";

type PaymentReturn = {
  status: "finish" | "pending";
  orderNumber: string;
};

export default function PaymentReturnNotice() {
  const [paymentReturn, setPaymentReturn] = useState<PaymentReturn | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("payment");
    const orderNumber = params.get("order_id")?.trim().toUpperCase() ?? "";

    if ((status === "finish" || status === "pending") && orderNumber) {
      setPaymentReturn({ status, orderNumber });
    }
  }, []);

  if (!paymentReturn) return null;

  const verifiedReturn = paymentReturn.status === "finish";
  const destination = `/order?order_number=${encodeURIComponent(paymentReturn.orderNumber)}&payment=${paymentReturn.status}`;

  return (
    <div className="bg-[#050505] px-6 pt-8 text-white md:px-12">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/16 bg-white/[0.065] p-6 md:p-9">
        <p className="visr-label text-white/42">
          {verifiedReturn ? "Payment received" : "Payment pending"}
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h1 className="text-3xl tracking-[-0.035em] md:text-4xl">
              {verifiedReturn
                ? "Your VISR payment is being verified."
                : "Your payment is awaiting confirmation."}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/52">
              Open your order status using the email or WhatsApp entered at checkout. Once payment is verified, the PDF payment receipt becomes available immediately.
            </p>
            <p className="mt-3 break-all font-mono text-xs text-white/35">
              {paymentReturn.orderNumber}
            </p>
          </div>
          <a
            href={destination}
            className="inline-flex justify-center rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition hover:bg-white/85"
          >
            Open Order & Receipt
          </a>
        </div>
      </div>
    </div>
  );
}
