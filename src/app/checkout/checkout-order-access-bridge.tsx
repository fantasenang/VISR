"use client";

import { useEffect } from "react";

export const ORDER_ACCESS_STORAGE_KEY = "visr:order-access:v1";

type StoredOrderAccess = {
  orderId: string;
  orderNumber: string;
  contact: string;
  email: string;
  whatsapp: string;
  expiresAt?: string;
  savedAt: string;
  cancelled?: boolean;
};

type SnapOptions = {
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (result: unknown) => void;
  onClose?: () => void;
  [key: string]: unknown;
};

type SnapApi = {
  pay: (token: string, options?: SnapOptions) => void;
  __visrWrapped?: boolean;
};

function readStoredAccess() {
  try {
    const raw = window.sessionStorage.getItem(ORDER_ACCESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) as StoredOrderAccess : null;
  } catch {
    return null;
  }
}

function rememberAccess(value: StoredOrderAccess) {
  try {
    window.sessionStorage.setItem(ORDER_ACCESS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Checkout remains functional when storage is blocked.
  }
}

async function releaseUnusedReservation() {
  const access = readStoredAccess();
  if (!access || access.cancelled) return;

  try {
    const response = await fetch("/api/orders/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: access.orderId,
        orderNumber: access.orderNumber,
        contact: access.contact,
      }),
      keepalive: true,
    });

    if (response.ok) {
      rememberAccess({ ...access, cancelled: true });
    }
  } catch {
    // The normal expiry process remains the fallback.
  }
}

export function CheckoutOrderAccessBridge() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

      if (method === "POST" && new URL(url, window.location.origin).pathname === "/api/orders") {
        try {
          const requestBody = typeof init?.body === "string" ? JSON.parse(init.body) as {
            customer?: { email?: string; whatsapp?: string };
          } : null;
          const payload = await response.clone().json() as {
            orderId?: string;
            orderNumber?: string;
            expiresAt?: string;
          };
          const email = requestBody?.customer?.email?.trim() ?? "";
          const whatsapp = requestBody?.customer?.whatsapp?.trim() ?? "";
          if (response.ok && payload.orderId && payload.orderNumber && (email || whatsapp)) {
            rememberAccess({
              orderId: payload.orderId,
              orderNumber: payload.orderNumber,
              contact: email || whatsapp,
              email,
              whatsapp,
              expiresAt: payload.expiresAt,
              savedAt: new Date().toISOString(),
            });
          }
        } catch {
          // Do not interfere with checkout when a response cannot be inspected.
        }
      }

      return response;
    };

    let wrappedSnap: SnapApi | null = null;
    let originalPay: SnapApi["pay"] | null = null;
    const wrapSnap = () => {
      const snap = (window as unknown as { snap?: SnapApi }).snap;
      if (!snap || snap.__visrWrapped) return;
      originalPay = snap.pay.bind(snap);
      snap.pay = (token, options = {}) => {
        originalPay?.(token, {
          ...options,
          onClose: () => {
            options.onClose?.();
            window.setTimeout(() => void releaseUnusedReservation(), 3_500);
          },
        });
      };
      snap.__visrWrapped = true;
      wrappedSnap = snap;
    };

    wrapSnap();
    const timer = window.setInterval(wrapSnap, 250);

    return () => {
      window.fetch = originalFetch;
      window.clearInterval(timer);
      if (wrappedSnap && originalPay) {
        wrappedSnap.pay = originalPay;
        delete wrappedSnap.__visrWrapped;
      }
    };
  }, []);

  return null;
}
