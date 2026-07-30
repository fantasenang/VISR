"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { calculateStackedPackage, formatRupiah, haloVariants, products } from "@/lib/commerce/catalog";
import { CustomerInformation, customerInformationSchema, normalizeWhatsApp } from "@/lib/commerce/customer-schema";

type HaloSelection = Record<string, boolean>;
type CheckoutStep = "products" | "information" | "review" | "reserved";
type FieldErrors = Partial<Record<keyof CustomerInformation, string>>;
type ReservationResult = { orderId: string; orderNumber: string; expiresAt: string };

const emptyCustomer: CustomerInformation = {
  fullName: "",
  whatsapp: "",
  email: "",
  address: "",
  province: "",
  city: "",
  postalCode: "",
  orderNotes: "",
  preorderConsent: false,
};

function QuantityControl({ value, min = 0, max, onChange }: { value: number; min?: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center rounded-full border border-white/15">
      <button type="button" aria-label="Decrease quantity" onClick={() => onChange(Math.max(min, value - 1))} className="h-10 w-10 text-lg text-white/65 transition hover:text-white">−</button>
      <input aria-label="Quantity" inputMode="numeric" value={value} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))} className="w-10 bg-transparent text-center text-sm outline-none" />
      <button type="button" aria-label="Increase quantity" onClick={() => onChange(Math.min(max, value + 1))} className="h-10 w-10 text-lg text-white/65 transition hover:text-white">+</button>
    </div>
  );
}

function Field({ label, name, value, error, multiline = false, required = true, onChange }: { label: string; name: keyof CustomerInformation; value: string; error?: string; multiline?: boolean; required?: boolean; onChange: (name: keyof CustomerInformation, value: string) => void }) {
  const classes = `mt-2 w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition ${error ? "border-red-400/70" : "border-white/12 focus:border-white/40"}`;
  return (
    <label className="block text-sm text-white/65">
      {label}{required ? " *" : ""}
      {multiline ? <textarea name={name} value={value} onChange={(event) => onChange(name, event.target.value)} rows={4} className={classes} /> : <input name={name} value={value} onChange={(event) => onChange(name, event.target.value)} className={classes} />}
      {error && <span className="mt-2 block text-xs text-red-300">{error}</span>}
    </label>
  );
}

export function CheckoutClient() {
  const [step, setStep] = useState<CheckoutStep>("products");
  const [carryQty, setCarryQty] = useState(1);
  const [linkQty, setLinkQty] = useState(0);
  const [halo, setHalo] = useState<HaloSelection>({});
  const [customer, setCustomer] = useState<CustomerInformation>(emptyCustomer);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [reservation, setReservation] = useState<ReservationResult | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [step]);

  const selectedHalo = haloVariants.filter((variant) => halo[variant.id]);
  const subtotal = carryQty * products.carry.price + selectedHalo.length * products.halo.price + linkQty * products.additionalLink.price;
  const totalWeight = carryQty * products.carry.weightGrams + selectedHalo.length * products.halo.weightGrams + linkQty * products.additionalLink.weightGrams;
  const totalBoxes = carryQty + selectedHalo.length + linkQty;
  const packageSize = useMemo(() => calculateStackedPackage(totalBoxes), [totalBoxes]);

  const items = useMemo(() => [
    ...(carryQty > 0 ? [{ sku: products.carry.sku, quantity: carryQty }] : []),
    ...selectedHalo.map((variant) => ({ sku: variant.sku, quantity: 1 })),
    ...(linkQty > 0 ? [{ sku: products.additionalLink.sku, quantity: linkQty }] : []),
  ], [carryQty, linkQty, selectedHalo]);

  const updateCustomer = (name: keyof CustomerInformation, value: string | boolean) => {
    setCustomer((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const continueToInformation = () => {
    if (subtotal > 0) setStep("information");
  };

  const continueToReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = customerInformationSchema.safeParse(customer);
    if (!result.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of result.error.issues) nextErrors[issue.path[0] as keyof CustomerInformation] = issue.message;
      setErrors(nextErrors);
      return;
    }
    setCustomer({ ...result.data, whatsapp: normalizeWhatsApp(result.data.whatsapp) });
    setErrors({});
    setStep("review");
  };

  const createReservation = async () => {
    if (isSubmitting || items.length === 0) return;
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            fullName: customer.fullName,
            whatsapp: normalizeWhatsApp(customer.whatsapp),
            email: customer.email,
            address: customer.address,
            province: customer.province,
            city: customer.city,
            postalCode: customer.postalCode,
            notes: customer.orderNotes ?? "",
            preorderConsent: true,
          },
          items,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Reservation could not be created.");

      setReservation(payload as ReservationResult);
      setStep("reserved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reservation could not be created.";
      setSubmitError(message.includes("stock") || message.includes("Stock") ? "One of your selected items is no longer available in that quantity. Please edit your reservation." : message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const payReservation = async () => {
    if (!reservation || isPaying) return;
    setIsPaying(true);
    setPaymentError("");

    try {
      const response = await fetch("/api/payments/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: reservation.orderId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Payment could not be started.");
      if (typeof payload.redirectUrl !== "string" || !payload.redirectUrl.startsWith("https://")) throw new Error("INVALID_PAYMENT_URL");
      window.location.assign(payload.redirectUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment could not be started.";
      setPaymentError(message === "PAYMENT_NOT_CONFIGURED" ? "Midtrans Sandbox is not configured yet." : message === "ORDER_EXPIRED" ? "This reservation has expired. Please create a new reservation." : "Payment could not be started. Please try again.");
      setIsPaying(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="visr-container py-12 md:py-20">
        <a href="/" className="visr-label text-white/45">← Back to exhibition</a>
        <div className="mt-10 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-white/35">
          <span className={step === "products" ? "text-white" : ""}>01 Products</span><span>—</span>
          <span className={step === "information" ? "text-white" : ""}>02 Information</span><span>—</span>
          <span className={step === "review" ? "text-white" : ""}>03 Review</span><span>—</span>
          <span className={step === "reserved" ? "text-white" : ""}>04 Reserved</span>
        </div>

        <div className="mt-12 grid gap-14 lg:grid-cols-[1.15fr_0.85fr]">
          <section>
            <p className="visr-label text-white/42">Reserve Your VISR</p>
            <h1 className="mt-5 max-w-[13ch] text-[clamp(2.75rem,6vw,5.5rem)] font-normal leading-[0.94] tracking-[-0.055em]">
              {step === "products" ? "Curate your Batch 2." : step === "information" ? "Delivery details." : step === "review" ? "Final review." : "Your VISR is reserved."}
            </h1>

            {step === "products" && <div className="mt-14 border-t border-white/10">
              <article className="grid gap-7 border-b border-white/10 py-9 md:grid-cols-[1fr_auto] md:items-center">
                <div><p className="text-2xl">VISR Carry Gen 2</p><p className="mt-2 text-sm text-white/45">Includes one VISR Link, new strap and premium packaging.</p><p className="mt-4">{formatRupiah(products.carry.price)}</p></div>
                <QuantityControl value={carryQty} min={0} max={products.carry.maxPerOrder} onChange={setCarryQty} />
              </article>
              <article className="border-b border-white/10 py-9">
                <div className="flex items-end justify-between gap-4"><div><p className="text-2xl">Halo Collection</p><p className="mt-2 text-sm text-white/45">Choose up to six colors. One unit per color.</p></div><p>{formatRupiah(products.halo.price)}</p></div>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">{haloVariants.map((variant) => { const selected = Boolean(halo[variant.id]); return <button key={variant.id} type="button" onClick={() => setHalo((current) => ({ ...current, [variant.id]: !current[variant.id] }))} className={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition ${selected ? "border-white bg-white text-black" : "border-white/12 text-white/70 hover:border-white/30"}`}><span>{variant.name}</span><span className="text-xs">{selected ? "Added ✓" : "Add"}</span></button>; })}</div>
              </article>
              <article className="grid gap-7 border-b border-white/10 py-9 md:grid-cols-[1fr_auto] md:items-center">
                <div><p className="text-2xl">Additional VISR Link</p><p className="mt-2 text-sm text-white/45">Every Carry already includes one. Add extras only when needed.</p><p className="mt-4">{formatRupiah(products.additionalLink.price)}</p></div>
                <QuantityControl value={linkQty} max={products.additionalLink.maxPerOrder} onChange={setLinkQty} />
              </article>
            </div>}

            {step === "information" && <form onSubmit={continueToReview} className="mt-12 grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Full name" name="fullName" value={customer.fullName} error={errors.fullName} onChange={updateCustomer} /></div>
              <Field label="WhatsApp number" name="whatsapp" value={customer.whatsapp} error={errors.whatsapp} onChange={updateCustomer} />
              <Field label="Email" name="email" value={customer.email} error={errors.email} onChange={updateCustomer} />
              <div className="sm:col-span-2"><Field label="Address" name="address" value={customer.address} error={errors.address} multiline onChange={updateCustomer} /></div>
              <Field label="Province" name="province" value={customer.province} error={errors.province} onChange={updateCustomer} />
              <Field label="City / Regency" name="city" value={customer.city} error={errors.city} onChange={updateCustomer} />
              <Field label="Postal code" name="postalCode" value={customer.postalCode} error={errors.postalCode} onChange={updateCustomer} />
              <div className="sm:col-span-2"><Field label="Order notes" name="orderNotes" value={customer.orderNotes ?? ""} error={errors.orderNotes} multiline required={false} onChange={updateCustomer} /></div>
              <label className="sm:col-span-2 flex gap-3 rounded-2xl border border-white/10 p-5 text-sm leading-6 text-white/55"><input type="checkbox" checked={customer.preorderConsent} onChange={(event) => updateCustomer("preorderConsent", event.target.checked)} className="mt-1" /><span>I understand that this is a pre-order item and shipping is estimated approximately two weeks after the pre-order closes.</span></label>
              {errors.preorderConsent && <p className="sm:col-span-2 text-xs text-red-300">{errors.preorderConsent}</p>}
              <div className="sm:col-span-2 flex gap-3"><button type="button" onClick={() => setStep("products")} className="rounded-full border border-white/15 px-6 py-4 text-sm">Back</button><button type="submit" className="flex-1 rounded-full bg-white px-6 py-4 text-sm font-medium text-black">Continue to Review</button></div>
            </form>}

            {step === "review" && <div className="mt-12 space-y-8">
              <div className="rounded-[2rem] border border-white/10 p-7"><p className="visr-label text-white/40">Customer</p><p className="mt-5 text-xl">{customer.fullName}</p><p className="mt-2 text-sm leading-6 text-white/50">+{customer.whatsapp}<br />{customer.email}<br />{customer.address}, {customer.city}, {customer.province} {customer.postalCode}</p>{customer.orderNotes && <p className="mt-4 text-sm text-white/40">Note: {customer.orderNotes}</p>}</div>
              {submitError && <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm leading-6 text-red-200">{submitError}</div>}
              <div className="flex gap-3"><button type="button" onClick={() => setStep("information")} disabled={isSubmitting} className="rounded-full border border-white/15 px-6 py-4 text-sm disabled:opacity-40">Edit Information</button><button type="button" onClick={createReservation} disabled={isSubmitting} className="flex-1 rounded-full bg-white px-6 py-4 text-sm font-medium text-black disabled:cursor-wait disabled:opacity-55">{isSubmitting ? "Reserving stock…" : "Create Reservation"}</button></div>
            </div>}

            {step === "reserved" && reservation && <div className="mt-12 rounded-[2rem] border border-white/12 bg-white/[0.035] p-7 md:p-10">
              <p className="visr-label text-white/40">Reservation Confirmed</p>
              <p className="mt-6 text-sm text-white/45">Your order number</p>
              <p className="mt-2 break-all text-2xl tracking-[-0.03em] md:text-4xl">{reservation.orderNumber}</p>
              <p className="mt-8 max-w-xl text-sm leading-7 text-white/55">Your selected stock is held until {new Date(reservation.expiresAt).toLocaleString("en-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB. Complete payment before this deadline to secure your Batch 2 reservation.</p>
              {paymentError && <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm leading-6 text-red-200">{paymentError}</div>}
              <button type="button" onClick={payReservation} disabled={isPaying} className="mt-8 w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition hover:bg-white/85 disabled:cursor-wait disabled:opacity-55">{isPaying ? "Opening secure payment…" : `Pay ${formatRupiah(subtotal)} with Midtrans`}</button>
              <p className="mt-5 text-xs leading-5 text-white/32">Save this order number. Midtrans will handle the payment securely, while the webhook confirms the final payment status.</p>
            </div>}
          </section>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-7 md:p-9">
              <p className="visr-label text-white/42">Reservation Summary</p>
              <div className="mt-8 space-y-5 text-sm">
                {carryQty > 0 && <div className="flex justify-between gap-4"><span>VISR Carry Gen 2 × {carryQty}</span><span>{formatRupiah(carryQty * products.carry.price)}</span></div>}
                {selectedHalo.map((variant) => <div key={variant.id} className="flex justify-between gap-4"><span>{variant.name}</span><span>{formatRupiah(products.halo.price)}</span></div>)}
                {linkQty > 0 && <div className="flex justify-between gap-4"><span>Additional VISR Link × {linkQty}</span><span>{formatRupiah(linkQty * products.additionalLink.price)}</span></div>}
              </div>
              <div className="mt-8 border-t border-white/10 pt-6"><div className="flex justify-between text-lg"><span>Subtotal</span><span>{formatRupiah(subtotal)}</span></div><p className="mt-3 text-xs leading-5 text-white/40">Shipping is calculated from the destination and paid by the customer.</p></div>
              <div className="mt-8 rounded-2xl bg-white/[0.05] p-5 text-xs leading-5 text-white/50"><p>{totalWeight.toLocaleString("en-ID")} g estimated product weight</p><p>{packageSize.lengthCm} × {packageSize.widthCm} × {packageSize.heightCm} cm stacked package</p><p>{totalBoxes} box{totalBoxes === 1 ? "" : "es"}</p></div>
              {step === "products" && <button type="button" onClick={continueToInformation} disabled={subtotal === 0} className="mt-7 w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-30">Continue to Information</button>}
              <p className="mt-5 text-center text-xs text-white/32">Payments are verified server-side through Midtrans notifications.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
