import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QrisVerifyForm from "./qris-verify-form";
import { getAdminSession } from "@/lib/admin/auth";
import { getPendingQrisClaims } from "@/lib/admin/qris";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QRIS Verification — VISR Control",
  robots: { index: false, follow: false },
};

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export default async function QrisVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; error?: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/visr-control");

  const [claims, params] = await Promise.all([
    getPendingQrisClaims(),
    searchParams,
  ]);

  return (
    <main className="min-h-screen bg-[#030303] px-5 py-8 text-white sm:px-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-sm tracking-[0.24em]">VISR.</p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/35">Control / QRIS Verification</p>
          </div>
          <a href="/visr-control" className="rounded-full border border-white/15 px-5 py-3 text-sm transition hover:bg-white hover:text-black">Back to Control</a>
        </div>

        <section className="py-12 md:py-16">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Manual payment operations</p>
          <h1 className="mt-5 text-[clamp(3rem,9vw,6.5rem)] font-normal leading-[0.9] tracking-[-0.065em]">Match. Verify. Secure.</h1>
          <p className="mt-7 max-w-2xl text-sm leading-7 text-white/48">
            Review the customer upload, then only mark an order paid after the exact amount appears in the BCA merchant transaction record. The uploaded image is supporting evidence, not settlement confirmation.
          </p>
        </section>

        {params.verified ? (
          <div className="mb-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-5 text-sm text-emerald-100">
            Payment verified for {params.verified}.
          </div>
        ) : null}
        {params.error ? (
          <div className="mb-6 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-5 text-sm text-red-100">
            Verification was not applied. Refresh the queue and check the order status.
          </div>
        ) : null}

        <div className="mb-7 flex items-center justify-between">
          <p className="text-sm text-white/52">{claims.length} payment claim{claims.length === 1 ? "" : "s"} awaiting verification</p>
          <a href="/visr-control/qris" className="text-sm text-white/55 underline decoration-white/20 underline-offset-4">Refresh</a>
        </div>

        {claims.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-8 md:p-12">
            <p className="text-2xl tracking-[-0.04em]">No QRIS payments are waiting.</p>
            <p className="mt-4 text-sm leading-6 text-white/42">New claims appear here after a customer uploads proof and taps “I Have Paid”.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {claims.map((claim) => (
              <article key={claim.orderId} className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="font-mono text-xs text-white/42">{claim.orderNumber}</p>
                    <h2 className="mt-3 text-2xl tracking-[-0.04em]">{claim.customerName}</h2>
                    <p className="mt-2 text-xs text-white/35">Claimed {dateTime(claim.claimedAt)} WIB</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/32">Match this exact amount</p>
                    <p className="mt-3 text-3xl tracking-[-0.045em]">{rupiah(claim.expectedAmountIdr)}</p>
                    <p className="mt-2 font-mono text-xs text-white/38">Code +{String(claim.uniqueCode).padStart(3, "0")}</p>
                  </div>
                </div>

                <div className="mt-7 border-t border-white/10 pt-6">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/32">Customer payment proof</p>
                  {claim.proofAvailable ? (
                    <a
                      href={`/api/admin/qris/proof?orderNumber=${encodeURIComponent(claim.orderNumber)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 block overflow-hidden rounded-[1.5rem] border border-white/10 bg-black"
                    >
                      <img
                        src={`/api/admin/qris/proof?orderNumber=${encodeURIComponent(claim.orderNumber)}`}
                        alt={`Payment proof for ${claim.orderNumber}`}
                        className="max-h-[34rem] w-full object-contain"
                      />
                    </a>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-sm text-amber-100/75">
                      No uploaded proof is attached to this legacy claim. Verify only from the BCA transaction record.
                    </div>
                  )}
                </div>

                <div className="mt-7 grid gap-6 border-t border-white/10 pt-6 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="space-y-2 text-sm text-white/50">
                    <p>Base order: {rupiah(claim.totalIdr)}</p>
                    <p>Reservation held until {dateTime(claim.paymentExpiresAt)} WIB</p>
                    <p>{claim.email}</p>
                    <a href={`https://wa.me/${claim.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex text-white/72 underline decoration-white/20 underline-offset-4">Open WhatsApp</a>
                  </div>

                  <QrisVerifyForm
                    orderNumber={claim.orderNumber}
                    expectedAmount={rupiah(claim.expectedAmountIdr)}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
