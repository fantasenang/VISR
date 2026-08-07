"use client";

import { FormEvent, useState } from "react";

type ApiResponse = {
  payment?: {
    orderNumber: string;
    paymentStatus: string;
    recordedAmountIdr: number;
    finalizedReservations: number;
    alreadyPaid: boolean;
  };
  error?: { message?: string };
};

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition focus:border-white/30";

export default function ManualPaymentClient() {
  const [orderNumber, setOrderNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ApiResponse["payment"] | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);

    const amountIdr = Number(amount.replace(/\D/g, ""));
    if (!Number.isSafeInteger(amountIdr) || amountIdr <= 0) {
      setError("Masukkan nominal dana yang benar-benar masuk ke rekening.");
      return;
    }

    const confirmed = window.confirm(
      `Konfirmasi dana ${rupiah(amountIdr)} sudah benar-benar masuk untuk ${orderNumber.trim()}?\n\n` +
        "Tindakan ini akan mengubah pembayaran menjadi PAID dan memfinalisasi stok.",
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const response = await fetch("/api/admin/payments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: orderNumber.trim().toUpperCase(),
          amountIdr,
          reference: reference.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !payload.payment) {
        throw new Error(payload.error?.message ?? "Manual payment could not be verified.");
      }
      setResult(payload.payment);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Manual payment could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#030303] px-5 py-10 text-[#f5f5f2] sm:px-8">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <span className="text-sm tracking-[0.24em]">VISR</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">Control / Manual Payment</span>
        </div>

        <a href="/visr-control" className="mt-8 inline-block text-xs text-white/45 underline underline-offset-4">
          Back to dashboard
        </a>

        <p className="mt-10 text-[10px] uppercase tracking-[0.18em] text-white/35">Bank reconciliation</p>
        <h1 className="mt-4 text-4xl tracking-[-0.05em]">Mark payment received.</h1>
        <p className="mt-5 text-sm leading-6 text-white/48">
          Gunakan hanya setelah nominal dan transaksi benar-benar terlihat di rekening BCA. Status customer,
          payment record, reservation, dan stok akan diperbarui dalam satu transaksi database.
        </p>

        <form onSubmit={submit} className="mt-9 space-y-5">
          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">Order number</span>
            <input
              className={inputClass}
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              placeholder="VISR.B02.20260807.004"
              autoCapitalize="characters"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">Amount received</span>
            <input
              className={inputClass}
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
              placeholder="397000"
              inputMode="numeric"
              required
            />
            {amount ? <span className="mt-2 block text-xs text-white/35">{rupiah(Number(amount))}</span> : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">Bank reference — optional</span>
            <input
              className={inputClass}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="BCA transaction reference"
              maxLength={200}
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</p>
          ) : null}

          {result ? (
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4 text-sm leading-6 text-emerald-100">
              <p>{result.orderNumber} sekarang PAID.</p>
              <p>{rupiah(result.recordedAmountIdr)} tercatat sebagai manual BCA verification.</p>
              <p>{result.finalizedReservations} reservasi stok difinalisasi.</p>
            </div>
          ) : null}

          <button
            className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy}
          >
            {busy ? "Verifying payment…" : "Confirm payment received"}
          </button>
        </form>
      </div>
    </main>
  );
}
