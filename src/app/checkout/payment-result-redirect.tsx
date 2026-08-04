"use client";

import { useEffect } from "react";

const ORDER_ACCESS_STORAGE_KEY = "visr:order-access:v1";

type StoredOrderAccess = {
  orderNumber?: string;
  contact?: string;
  cancelled?: boolean;
};

function readStoredOrderNumber() {
  try {
    const raw = window.sessionStorage.getItem(ORDER_ACCESS_STORAGE_KEY);
    if (!raw) return "";
    const access = JSON.parse(raw) as StoredOrderAccess;
    if (access.cancelled || !access.contact) return "";
    return (access.orderNumber ?? "").trim().toUpperCase();
  } catch {
    return "";
  }
}

export default function PaymentResultRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const callbackOrderNumber = (params.get("order_id") ?? params.get("order_number") ?? "")
      .trim()
      .toUpperCase();
    const orderNumber = callbackOrderNumber || readStoredOrderNumber();

    if (!payment || !orderNumber) return;

    const destination = new URL("/order", window.location.origin);
    destination.searchParams.set("order_number", orderNumber);
    destination.searchParams.set("autoview", "1");
    destination.searchParams.set("payment", payment);
    window.location.replace(destination.toString());
  }, []);

  return null;
}
