"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  calculatePacking,
  courierLabel,
  formatRupiah,
  type CheckoutCourier,
  type ShippingDestination,
  type ShippingRate,
} from "@/lib/shipping";

type ProductVariant = { id: string; name: string; slug: string; sku: string; price: number; stock: number };
type Product = { id: string; name: string; slug: string; sku?: string; price: number; stock: number; variants: ProductVariant[] };
type CheckoutProducts = { carry: Product; halo: Product; additionalLink: Product };
type CustomerInformation = {
  fullName: string;
  whatsapp: string;
  email: string;
  address: string;
  province: string;
  city: string;
  postalCode: string;
  orderNotes: string;
};
type Reservation = { orderId: string; orderNumber: string; expiresAt: string; paymentAmount: number };
type OrderResponse = { orderId?: string; orderNumber?: string; expiresAt?: string; totalIdr?: number; error?: string };
type PaymentResponse = { token?: string; redirectUrl?: string; error?: string };
type SnapResult = { order_id?: string; transaction_status?: string };
type SnapOptions = {
  onSuccess?: (result: SnapResult) => void;
  onPending?: (result: SnapResult) => void;
  onError?: (result: SnapResult) => void;
  onClose?: () => void;
};

declare global {
  interface Window {
    snap?: { pay: (token: string, options?: SnapOptions) => void };
  }
}

const emptyCustomer: CustomerInformation = {
  fullName: "",
  whatsapp: "62",
  email: "",
  address: "",
  province: "",
  city: "",
  postalCode: "",
  orderNotes: "",
};

export default function CheckoutClient({ products }: { products: CheckoutProducts }) {
  const [carryQty, setCarryQty] = useState(0);
  const [haloVariantIds, setHaloVariantIds] = useState<string[]>([]);
  const [linkQty, setLinkQty] = useState(0);
  const [customer, setCustomer] = useState<CustomerInformation>(emptyCustomer);
  const [step, setStep] = useState<"products" | "information" | "review" | "reserved">("products");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [destinationOptions, setDestinationOptions] = useState<ShippingDestination[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<ShippingDestination | null>(null);
  const [courier, setCourier] = useState<CheckoutCourier>("jne");
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [isResolvingPostalCode, setIsResolvingPostalCode] = useState(false);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [shippingError, setShippingError] = useState("");

  const selectedHalo = useMemo(
    () => products.halo.variants.filter((variant) => haloVariantIds.includes(variant.id)),
    [haloVariantIds, products.halo.variants],
  );
  const packing = useMemo(
    () => calculatePacking({ carryQty, haloQty: selectedHalo.length, additionalLinkQty: linkQty }),
    [carryQty, linkQty, selectedHalo.length],
  );
  const subtotal = useMemo(
    () => carryQty * products.carry.price + selectedHalo.length * products.halo.price + linkQty * products.additionalLink.price,
    [carryQty, linkQty, products.additionalLink.price, products.carry.price, products.halo.price, selectedHalo.length],
  );
  const visibleRates = useMemo(() => rates.filter((rate) => rate.courier === courier), [courier, rates]);
  const shippingCost = selectedRate?.costIdr ?? 0;
  const grandTotal = subtotal + shippingCost;

  function selectDestination(destination: ShippingDestination) {
    setSelectedDestination(destination);
    setDestinationOptions([]);
    setCustomer((current) => ({
      ...current,
      province: destination.provinceName,
      city: destination.cityName,
      postalCode: destination.zipCode,
    }));
  }

  useEffect(() => {
    const postalCode = customer.postalCode;
    setSelectedDestination(null);
    setDestinationOptions([]);
    setRates([]);
    setSelectedRate(null);
    setCustomer((current) => ({ ...current, province: "", city: "" }));
    setShippingError("");

    if (step !== "information" || !/^\d{5}$/.test(postalCode)) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsResolvingPostalCode(true);
      try {
        const response = await fetch(`/api/shipping/destinations?search=${postalCode}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as { destinations?: ShippingDestination[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to identify this postal code.");

        const exact = (payload.destinations ?? []).filter((destination) => destination.zipCode === postalCode);
        if (exact.length === 0) throw new Error("Postal code was not found. Check the 5 digits and try again.");
        if (exact.length === 1) selectDestination(exact[0]);
        else setDestinationOptions(exact);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setShippingError(error instanceof Error ? error.message : "Unable to identify this postal code.");
      } finally {
        setIsResolvingPostalCode(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [customer.postalCode, step]);

  useEffect(() => {
    if (step !== "information" || !selectedDestination || subtotal === 0) return;
    const controller = new AbortController();
    setIsLoadingRates(true);
    setRates([]);
    setSelectedRate(null);
    setShippingError("");

    fetch("/api/shipping/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destinationId: selectedDestination.id,
        cart: { carryQty, haloQty: selectedHalo.length, linkQty },
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { rates?: ShippingRate[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to calculate shipping.");
        setRates(payload.rates ?? []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setShippingError(error instanceof Error ? error.message : "Unable to calculate shipping.");
      })
      .finally(() => setIsLoadingRates(false));

    return () => controller.abort();
  }, [carryQty, linkQty, selectedDestination, selectedHalo.length, step, subtotal]);

  useEffect(() => {
    setSelectedRate(null);
  }, [courier]);

  const toggleHalo = (variantId: string) => {
    setHaloVariantIds((current) => current.includes(variantId) ? current.filter((id) => id !== variantId) : [...current, variantId]);
  };

  const submitInformation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDestination) return setShippingError("Enter a valid postal code and select the matching area.");
    if (!selectedRate) return setShippingError("Select a shipping service before reviewing your reservation.");
    setShippingError("");
    setStep("review");
  };

  const createReservation = async () => {
    if (!selectedDestination || !selectedRate || !products.carry.sku || !products.additionalLink.sku) return;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const items = [
        ...(carryQty > 0 ? [{ sku: products.carry.sku, quantity: carryQty }] : []),
        ...selectedHalo.map((variant) => ({ sku: variant.sku, quantity: 1 })),
        ...(linkQty > 0 ? [{ sku: products.additionalLink.sku, quantity: linkQty }] : []),
      ];
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            fullName: customer.fullName,
            whatsapp: customer.whatsapp,
            email: customer.email,
            address: customer.address,
            province: customer.province,
            city: customer.city,
            postalCode: customer.postalCode,
            notes: customer.orderNotes,
            preorderConsent: true,
          },
          items,
          shipping: {
            destinationId: selectedDestination.id,
            destinationLabel: selectedDestination.label,
            courier: selectedRate.courier,
            service: selectedRate.service,
            quotedCostIdr: selectedRate.costIdr,
          },
        }),
      });
      const payload = (await response.json()) as OrderResponse;
      if (!response.ok || !payload.orderId || !payload.orderNumber || !payload.expiresAt || typeof payload.totalIdr !== "number") {
        throw new Error(payload.error || "Could not create your reservation.");
      }
      setReservation({ orderId: payload.orderId, orderNumber: payload.orderNumber, expiresAt: payload.expiresAt, paymentAmount: payload.totalIdr });
      setStep("reserved");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not create your reservation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const payReservation = async () => {
    if (!reservation) return;
    setIsPaying(true);
    setPaymentError("");
    try {
      const response = await fetch("/api/payments/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: reservation.orderId }),
      });
      const payload = (await response.json()) as PaymentResponse;
      if (!response.ok || !payload.token) throw new Error(payload.error || "Could not start payment.");
      if (window.snap) {
        window.snap.pay(payload.token, {
          onSuccess: () => window.location.assign(`/checkout?payment=finish&order_id=${encodeURIComponent(reservation.orderNumber)}`),
          onPending: () => window.location.assign(`/checkout?payment=pending&order_id=${encodeURIComponent(reservation.orderNumber)}`),
          onError: () => setPaymentError("Payment could not be completed. Your reservation remains active until the deadline above."),
          onClose: () => setIsPaying(false),
        });
        return;
      }
      if (payload.redirectUrl) window.location.assign(payload.redirectUrl);
      else throw new Error("Payment window is not ready. Refresh the page and try again.");
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Could not start payment.");
      setIsPaying(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-6 py-10 md:px-12 md:py-16">
        <div className="mb-10 border-b border-white/10 pb-8"><p className="visr-label text-white/40">VISR Private Reservation</p><h1 className="mt-4 max-w-3xl text-4xl tracking-[-0.04em] md:text-6xl">Complete your Batch 2 reservation.</h1></div>
        <div className="grid gap-10 lg:grid-cols-[1fr_390px]">
          <section>
            {step === "products" && <div className="space-y-6">
              <ProductCard label="Core System" title={products.carry.name} note="Includes 1 VISR Link · 500 g product weight" price={products.carry.price} stock={products.carry.stock}><QuantityControl value={carryQty} max={Math.min(products.carry.stock, 3)} onChange={setCarryQty} /></ProductCard>
              <article className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-7 md:p-9"><div className="flex items-start justify-between gap-6"><div><p className="visr-label text-white/40">Halo Collection</p><h2 className="mt-3 text-2xl">Choose your halo.</h2><p className="mt-3 text-sm text-white/45">Each Halo is 150 g. One per color.</p></div><p className="text-lg">{formatRupiah(products.halo.price)}</p></div><div className="mt-7 grid gap-3 sm:grid-cols-2">{products.halo.variants.map((variant) => { const selected = haloVariantIds.includes(variant.id); return <button key={variant.id} type="button" disabled={variant.stock === 0} onClick={() => toggleHalo(variant.id)} className={`rounded-2xl border p-5 text-left transition ${selected ? "border-white bg-white text-black" : "border-white/10 bg-black/20 hover:border-white/30"} disabled:opacity-30`}><span className="block">{variant.name}</span><span className={`mt-2 block text-xs ${selected ? "text-black/55" : "text-white/35"}`}>{variant.stock} available</span></button>; })}</div></article>
              <ProductCard label="Optional Add-on" title="Additional VISR Link" note="25 g each · for wall, desk, and future VISR systems." price={products.additionalLink.price} stock={products.additionalLink.stock}><QuantityControl value={linkQty} max={Math.min(products.additionalLink.stock, 5)} onChange={setLinkQty} /></ProductCard>
            </div>}

            {step === "information" && <form onSubmit={submitInformation} className="mt-12 space-y-8">
              <div><p className="visr-label text-white/40">Information</p><h2 className="mt-3 text-3xl">Where should we send your VISR?</h2></div>
              <div className="grid gap-4 md:grid-cols-2"><TextField label="Full name" value={customer.fullName} onChange={(value) => setCustomer({ ...customer, fullName: value })} required /><TextField label="WhatsApp" value={customer.whatsapp} onChange={(value) => setCustomer({ ...customer, whatsapp: value.replace(/\D/g, "") })} required /><TextField label="Email" type="email" value={customer.email} onChange={(value) => setCustomer({ ...customer, email: value })} required /><TextField label="Postal code" inputMode="numeric" maxLength={5} value={customer.postalCode} onChange={(value) => setCustomer({ ...customer, postalCode: value.replace(/\D/g, "").slice(0, 5) })} required /></div>
              {isResolvingPostalCode && <p className="text-sm text-white/40">Identifying postal code…</p>}
              {destinationOptions.length > 1 && <div className="rounded-[2rem] border border-white/10 p-6"><p className="text-sm text-white/55">Choose the area that matches your address.</p><div className="mt-4 space-y-2">{destinationOptions.map((destination) => <button key={destination.id} type="button" onClick={() => selectDestination(destination)} className="w-full rounded-2xl border border-white/10 p-4 text-left text-sm hover:border-white/30">{destination.label}</button>)}</div><p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-white/28">Powered by RajaOngkir</p></div>}
              <TextField label="Street address" value={customer.address} onChange={(value) => setCustomer({ ...customer, address: value })} required />
              <div className="grid gap-4 md:grid-cols-2"><TextField label="Province" value={customer.province} onChange={() => undefined} readOnly required /><TextField label="City / Regency" value={customer.city} onChange={() => undefined} readOnly required /></div>
              <div className="rounded-[2rem] border border-white/10 p-6"><p className="visr-label text-white/40">Courier</p><div className="mt-4 grid grid-cols-2 gap-3">{(["jne", "jnt"] as CheckoutCourier[]).map((item) => <button key={item} type="button" onClick={() => setCourier(item)} className={`rounded-2xl border p-4 text-sm ${courier === item ? "border-white bg-white text-black" : "border-white/10"}`}>{item === "jne" ? "JNE" : "J&T Express"}</button>)}</div><div className="mt-5 space-y-3">{isLoadingRates && <p className="text-sm text-white/40">Calculating shipping…</p>}{!isLoadingRates && selectedDestination && visibleRates.length === 0 && <p className="text-sm text-white/40">No service available from this courier.</p>}{visibleRates.map((rate) => <button key={rate.id ?? `${rate.courier}-${rate.service}`} type="button" onClick={() => setSelectedRate(rate)} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${selectedRate?.id === rate.id ? "border-white bg-white text-black" : "border-white/10"}`}><span><span className="block text-sm">{courierLabel(rate)}</span><span className={`mt-1 block text-xs ${selectedRate?.id === rate.id ? "text-black/55" : "text-white/35"}`}>{rate.etd ? `${rate.etd} days` : rate.description}</span></span><span>{formatRupiah(rate.costIdr)}</span></button>)}</div><p className="mt-5 text-[10px] uppercase tracking-[0.18em] text-white/28">Powered by RajaOngkir</p></div>
              <label className="block"><span className="mb-2 block text-xs uppercase tracking-[0.16em] text-white/35">Order notes</span><textarea value={customer.orderNotes} onChange={(event) => setCustomer({ ...customer, orderNotes: event.target.value })} rows={4} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-white/35" /></label>
              {shippingError && <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-200">{shippingError}</div>}
              <div className="flex gap-3"><button type="button" onClick={() => setStep("products")} className="rounded-full border border-white/15 px-6 py-4 text-sm">Back</button><button type="submit" className="flex-1 rounded-full bg-white px-6 py-4 text-sm font-medium text-black">Review Reservation</button></div>
            </form>}

            {step === "review" && <div className="mt-12 space-y-8"><div className="rounded-[2rem] border border-white/10 p-7"><p className="visr-label text-white/40">Customer</p><p className="mt-5 text-xl">{customer.fullName}</p><p className="mt-2 text-sm leading-6 text-white/50">+{customer.whatsapp}<br />{customer.email}<br />{customer.address}, {customer.city}, {customer.province} {customer.postalCode}</p></div>{selectedDestination && selectedRate && <div className="rounded-[2rem] border border-white/10 p-7"><p className="visr-label text-white/40">Shipping</p><p className="mt-5 text-xl">{courierLabel(selectedRate)}</p><p className="mt-2 text-sm text-white/50">{selectedDestination.label}<br />{formatRupiah(selectedRate.costIdr)}</p></div>}{submitError && <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-200">{submitError}</div>}<div className="flex gap-3"><button type="button" onClick={() => setStep("information")} className="rounded-full border border-white/15 px-6 py-4 text-sm">Edit Information</button><button type="button" onClick={createReservation} disabled={isSubmitting} className="flex-1 rounded-full bg-white px-6 py-4 text-sm font-medium text-black disabled:opacity-55">{isSubmitting ? "Reserving stock…" : "Create Reservation"}</button></div></div>}

            {step === "reserved" && reservation && <div className="mt-12 rounded-[2rem] border border-white/12 bg-white/[0.035] p-7 md:p-10"><p className="visr-label text-white/40">Reservation Confirmed</p><p className="mt-6 text-sm text-white/45">Your order number</p><p className="mt-2 text-3xl">{reservation.orderNumber}</p><p className="mt-8 text-sm leading-7 text-white/55">Stock is held until {new Date(reservation.expiresAt).toLocaleString("en-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB.</p>{paymentError && <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-200">{paymentError}</div>}<button type="button" onClick={payReservation} disabled={isPaying} className="mt-8 w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black disabled:opacity-55">{isPaying ? "Opening secure payment…" : `Pay ${formatRupiah(reservation.paymentAmount)} with Midtrans`}</button></div>}
          </section>

          <aside className="lg:sticky lg:top-8 lg:self-start"><div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-7 md:p-9"><p className="visr-label text-white/42">Reservation Summary</p><div className="mt-8 space-y-5 text-sm">{carryQty > 0 && <SummaryLine label={`VISR Carry Gen 2 × ${carryQty}`} value={carryQty * products.carry.price} />}{selectedHalo.map((variant) => <SummaryLine key={variant.id} label={variant.name} value={products.halo.price} />)}{linkQty > 0 && <SummaryLine label={`Additional VISR Link × ${linkQty}`} value={linkQty * products.additionalLink.price} />}</div><div className="mt-8 space-y-3 border-t border-white/10 pt-6"><SummaryLine label="Subtotal" value={subtotal} /><div className="flex justify-between text-sm"><span>Shipping</span><span>{selectedRate ? formatRupiah(shippingCost) : "—"}</span></div><div className="flex justify-between border-t border-white/10 pt-4 text-lg"><span>Total</span><span>{formatRupiah(grandTotal)}</span></div></div><div className="mt-8 rounded-2xl bg-white/[0.05] p-5 text-xs leading-5 text-white/50"><p>{packing.actualWeightGrams.toLocaleString("en-ID")} g actual weight</p><p>{packing.lengthCm} × {packing.widthCm} × {packing.heightCm} cm packing profile</p></div>{step === "products" && <button type="button" onClick={() => subtotal > 0 && setStep("information")} disabled={subtotal === 0} className="mt-7 w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black disabled:opacity-30">Continue to Information</button>}</div></aside>
        </div>
      </div>
    </main>
  );
}

function ProductCard({ label, title, note, price, stock, children }: { label: string; title: string; note: string; price: number; stock: number; children: ReactNode }) { return <article className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-7 md:p-9"><div className="flex items-start justify-between gap-6"><div><p className="visr-label text-white/40">{label}</p><h2 className="mt-3 text-2xl">{title}</h2><p className="mt-3 text-sm text-white/45">{note}</p></div><p className="text-lg">{formatRupiah(price)}</p></div><div className="mt-7 flex items-center justify-between border-t border-white/10 pt-6"><p className="text-xs text-white/35">{stock} available</p>{children}</div></article>; }
function QuantityControl({ value, max, onChange }: { value: number; max: number; onChange: (value: number) => void }) { return <div className="flex items-center rounded-full border border-white/12"><button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="px-4 py-2 text-lg">−</button><span className="min-w-10 text-center text-sm">{value}</span><button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="px-4 py-2 text-lg">+</button></div>; }
function TextField({ label, value, onChange, required, type = "text", readOnly, inputMode, maxLength }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; readOnly?: boolean; inputMode?: "text" | "numeric" | "email" | "tel"; maxLength?: number }) { return <label className="block"><span className="mb-2 block text-xs uppercase tracking-[0.16em] text-white/35">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} readOnly={readOnly} inputMode={inputMode} maxLength={maxLength} className={`w-full rounded-2xl border border-white/10 px-4 py-3 text-sm outline-none ${readOnly ? "bg-white/[0.02] text-white/55" : "bg-white/[0.04] focus:border-white/35"}`} /></label>; }
function SummaryLine({ label, value }: { label: string; value: number }) { return <div className="flex justify-between gap-4"><span>{label}</span><span>{formatRupiah(value)}</span></div>; }
