"use client";

import type { FormEvent } from "react";

export default function QrisVerifyForm({
  orderNumber,
  expectedAmount,
}: {
  orderNumber: string;
  expectedAmount: string;
}) {
  function confirmVerification(event: FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `Mark ${orderNumber} as PAID?\n\nConfirm that ${expectedAmount} is visible in the BCA merchant transaction record. Customer screenshots are not sufficient.`,
    );
    if (!confirmed) event.preventDefault();
  }

  return (
    <form action="/api/admin/qris/verify" method="post" onSubmit={confirmVerification}>
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <button className="w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition hover:bg-white/85 md:w-auto">
        Mark Payment Verified
      </button>
    </form>
  );
}
