"use client";

import Image from "next/image";
import { useState } from "react";

const MAX_PROOF_BYTES = 4 * 1024 * 1024;
const PROOF_TYPES = new Set(["image/jpeg", "image/png"]);

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

type ClaimResponse = {
  pendingVerification?: boolean;
  extendedUntil?: string;
  error?: { message?: string };
};

type ProofResponse = {
  uploaded?: boolean;
  proofId?: string;
  fileName?: string;
  error?: { message?: string };
};

export default function QrisPaymentClient({
  orderNumber,
  totalIdr,
  paymentAmountIdr,
  uniqueCode,
  paymentExpiresAt,
  token,
}: {
  orderNumber: string;
  totalIdr: number;
  paymentAmountIdr: number;
  uniqueCode: number;
  paymentExpiresAt: string;
  token: string;
}) {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proofId, setProofId] = useState("");
  const [proofName, setProofName] = useState("");
  const [proofPreview, setProofPreview] = useState("");
  const [message, setMessage] = useState("");

  async function copyAmount() {
    try {
      await navigator.clipboard.writeText(String(paymentAmountIdr));
      setMessage("Payment amount copied.");
    } catch {
      setMessage("Copy failed. Enter the amount exactly as shown.");
    }
  }

  async function uploadProof(file: File) {
    if (!PROOF_TYPES.has(file.type)) {
      setMessage("Use a JPG or PNG payment proof.");
      return;
    }
    if (file.size < 1 || file.size > MAX_PROOF_BYTES) {
      setMessage("Payment proof must be 4 MB or smaller.");
      return;
    }

    const nextPreview = URL.createObjectURL(file);
    setProofPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return nextPreview;
    });
    setProofId("");
    setProofName(file.name);
    setUploading(true);
    setMessage("Uploading payment proof…");

    try {
      const body = new FormData();
      body.append("orderNumber", orderNumber);
      body.append("token", token);
      body.append("proof", file, file.name);

      const response = await fetch("/api/payments/qris/proof", {
        method: "POST",
        body,
      });
      const payload = (await response.json().catch(() => ({}))) as ProofResponse;
      if (!response.ok || !payload.uploaded || !payload.proofId) {
        throw new Error(payload.error?.message ?? "Payment proof could not be uploaded.");
      }

      setProofId(payload.proofId);
      setProofName(payload.fileName || file.name);
      setMessage("Payment proof uploaded. You can now submit your payment.");
    } catch (error) {
      setProofId("");
      setMessage(error instanceof Error ? error.message : "Payment proof could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function confirmPayment() {
    if (claiming || claimed || uploading || !proofId) return;
    setClaiming(true);
    setMessage("");

    try {
      const response = await fetch("/api/payments/qris/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, token, proofId }),
      });
      const payload = (await response.json().catch(() => ({}))) as ClaimResponse;
      if (!response.ok || !payload.pendingVerification) {
        throw new Error(payload.error?.message ?? "Payment confirmation could not be submitted.");
      }
      setClaimed(true);
      setMessage("Payment submitted. VISR will verify it against the BCA transaction record.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment confirmation could not be submitted.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#030303] px-5 py-8 text-white sm:px-8 md:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <a href="/" className="text-sm tracking-[0.24em]">VISR.</a>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">BCA QRIS</span>
        </div>

        <section className="py-12 md:py-16">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Secure your reservation</p>
          <h1 className="mt-5 text-[clamp(3.2rem,10vw,7rem)] font-normal leading-[0.9] tracking-[-0.065em]">Scan. Pay. Confirm.</h1>
          <p className="mt-7 max-w-xl text-sm leading-7 text-white/48">
            Scan using any mobile-banking or e-wallet app. Enter the exact amount below so the payment can be matched to your order.
          </p>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#080808]">
          <div className="border-b border-white/10 px-6 py-5 md:px-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/32">Order</p>
                <p className="mt-2 break-all font-mono text-sm text-white/72">{orderNumber}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/32">Payment deadline</p>
                <p className="mt-2 text-sm text-white/72">
                  {new Date(paymentExpiresAt).toLocaleString("en-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Jakarta",
                  })} WIB
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-10 p-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.82fr)] md:p-9">
            <div>
              <div className="rounded-[1.5rem] bg-white p-4 md:p-5">
                <Image
                  src="/api/payments/qris/image?mode=inline"
                  alt="VISR BCA QRIS payment code"
                  width={915}
                  height={915}
                  unoptimized
                  priority
                  className="aspect-square w-full object-contain"
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <a
                  href="/api/payments/qris/image"
                  download="VISR-QRIS-BCA.png"
                  className="rounded-full border border-white/15 px-4 py-3 text-center text-sm transition hover:bg-white hover:text-black"
                >
                  Download QRIS
                </a>
                <a
                  href="/api/payments/qris/image?mode=inline"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/15 px-4 py-3 text-center text-sm transition hover:bg-white hover:text-black"
                >
                  Open Fullscreen
                </a>
              </div>
            </div>

            <div className="flex flex-col justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/32">Pay exactly</p>
                <p className="mt-4 text-[clamp(2.5rem,8vw,4.5rem)] leading-none tracking-[-0.055em]">{rupiah(paymentAmountIdr)}</p>
                <button type="button" onClick={copyAmount} className="mt-5 text-sm text-white/55 underline decoration-white/20 underline-offset-4 transition hover:text-white">
                  Copy payment amount
                </button>

                <div className="mt-9 space-y-4 border-t border-white/10 pt-7 text-sm leading-6 text-white/50">
                  <div className="flex justify-between gap-6"><span>Order total</span><span className="text-white/75">{rupiah(totalIdr)}</span></div>
                  <div className="flex justify-between gap-6"><span>Order matching code</span><span className="font-mono text-white/75">+{String(uniqueCode).padStart(3, "0")}</span></div>
                  <p className="pt-2 text-xs leading-5 text-white/32">The matching code is included in your payment total and is not an additional service charge.</p>
                </div>
              </div>

              <div className="mt-10">
                <div className="mb-5 rounded-[1.35rem] border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-start gap-4">
                    {proofPreview ? (
                      <img src={proofPreview} alt="Selected payment proof" className="h-16 w-16 rounded-xl border border-white/10 object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 text-[10px] uppercase tracking-[0.12em] text-white/25">Proof</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/32">Payment proof required</p>
                      <p className="mt-2 truncate text-sm text-white/62">{proofName || "Upload your successful payment screen"}</p>
                      <p className="mt-1 text-xs leading-5 text-white/30">JPG or PNG, maximum 4 MB.</p>
                    </div>
                  </div>
                  <label className={`mt-4 flex w-full cursor-pointer items-center justify-center rounded-full border border-white/15 px-4 py-3 text-sm transition hover:bg-white hover:text-black ${uploading || claimed ? "pointer-events-none opacity-50" : ""}`}>
                    {uploading ? "Uploading…" : proofId ? "Replace payment proof" : "Upload payment proof"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      className="sr-only"
                      disabled={uploading || claimed}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadProof(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={confirmPayment}
                  disabled={claiming || claimed || uploading || !proofId}
                  className="w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {claimed
                    ? "Awaiting Verification"
                    : claiming
                      ? "Submitting…"
                      : uploading
                        ? "Uploading Proof…"
                        : proofId
                          ? "I Have Paid"
                          : "Upload Proof to Continue"}
                </button>
                {message ? <p className="mt-4 text-sm leading-6 text-white/52">{message}</p> : null}
                {claimed ? (
                  <a href={`/order?order_number=${encodeURIComponent(orderNumber)}`} className="mt-5 inline-flex text-sm text-white/65 underline decoration-white/20 underline-offset-4">
                    Track this order →
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-4 text-xs leading-6 text-white/38 sm:grid-cols-3">
          <p>1. Download the QRIS image when paying from the same phone.</p>
          <p>2. Select scan from gallery and pay the exact amount shown.</p>
          <p>3. Upload the successful payment screen, then tap “I Have Paid”.</p>
        </div>
      </div>
    </main>
  );
}
