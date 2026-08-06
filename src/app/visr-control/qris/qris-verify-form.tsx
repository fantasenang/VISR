"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type VerifyResponse = {
  verified?: boolean;
  orderNumber?: string;
  error?: { message?: string };
};

export default function QrisVerifyForm({
  orderNumber,
  expectedAmount,
}: {
  orderNumber: string;
  expectedAmount: string;
}) {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  async function confirmVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verifying) return;

    const confirmed = window.confirm(
      `Mark ${orderNumber} as PAID?\n\nConfirm that ${expectedAmount} is visible in the BCA merchant transaction record. Customer screenshots are not sufficient.`,
    );
    if (!confirmed) return;

    setVerifying(true);
    setError("");

    try {
      const response = await fetch("/api/admin/qris/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber }),
      });
      const payload = (await response.json().catch(() => ({}))) as VerifyResponse;

      if (response.status === 401) {
        window.location.assign("/visr-control");
        return;
      }
      if (!response.ok || !payload.verified) {
        throw new Error(payload.error?.message ?? "Payment verification was not applied.");
      }

      window.location.assign(
        `/visr-control/qris?verified=${encodeURIComponent(payload.orderNumber ?? orderNumber)}`,
      );
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Payment verification was not applied.",
      );
      setVerifying(false);
    }
  }

  return (
    <form onSubmit={confirmVerification}>
      <button
        type="submit"
        disabled={verifying}
        className="w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-55 md:w-auto"
      >
        {verifying ? "Verifying…" : "Mark Payment Verified"}
      </button>
      {error ? <p className="mt-3 max-w-sm text-xs leading-5 text-red-200">{error}</p> : null}
    </form>
  );
}
