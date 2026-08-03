"use client";

import { useEffect } from "react";

export default function PaymentResultRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const orderNumber = (params.get("order_id") ?? params.get("order_number") ?? "")
      .trim()
      .toUpperCase();

    if (!payment || !orderNumber) return;

    const destination = new URL("/order", window.location.origin);
    destination.searchParams.set("order_number", orderNumber);
    destination.searchParams.set("autoview", "1");
    destination.searchParams.set("payment", payment);
    window.location.replace(destination.toString());
  }, []);

  return null;
}
