"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import {
  calculatePacking,
  courierLabel,
  formatRupiah,
  type CheckoutCourier,
  type ShippingDestination,
  type ShippingRate,
} from "@/lib/shipping";

type ProductVariant = {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  variants: ProductVariant[];
};

type CheckoutProducts = {
  carry: Product;
  halo: Product;
  additionalLink: Product;
};

type CustomerInformation = {
  fullName: string;
  whatsapp: string;
  email: string;
  address: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  orderNotes: string;
};

type Reservation = {
  orderNumber: string;
  expiresAt: string;
  paymentAmount: number;
};

type OrderResponse = {
  orderNumber?: string;
  expiresAt?: string;
  paymentAmount?: number;
  error?: string;
};

type PaymentResponse = {
  token?: string;
  redirectUrl?: string;
  error?: string;
};

type SnapResult = {
  order_id?: string;
  transaction_status?: string;
};

type SnapOptions = {
  onSuccess?: (result: SnapResult) => void;
  onPending?: (result: SnapResult) => void;
  onError?: (result: SnapResult) => void;
  onClose?: () => void;
};

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: SnapOptions) => void;
    };
  }
}

const emptyCustomer: CustomerInformation = {
  fullName: "",
  whatsapp: "62",
  email: "",
  address: "",
  province: "",
  city: "",
  district: "",
  postalCode: "",
  orderNotes: "",
};

export default function CheckoutClient({ products }: { products: CheckoutProducts }) {
  const router = useRouter();
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
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationOptions, setDestinationOptions] = useState<ShippingDestination[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<ShippingDestination | null>(null);
  const [courier, setCourier] = useState<CheckoutCourier>("jne");
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [isSearchingDestinations, setIsSearchingDestinations] = useState(false);
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
  const shippingCost = selectedRate?.costIdr ?? 0;
  const grandTotal = subtotal + shippingCost;

  useEffect(() => {
    if (step === "products") return;
    setSelectedRate(null);
    setRates([]);
  }, [courier, packing.actualWeightGrams, packing.heightCm, packing.lengthCm, packing.widthCm, selectedDestination?.id, step]);

  useEffect(() => {
    if (step !== "information" || !selectedDestination) return;

    const controller = new AbortController();
    setIsLoadingRates(true);
    setShippingError("");

    fetch("/api/shipping/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destinationId: selectedDestination.id,
        destinationPostalCode: selectedDestination.postalCode,
        courier,
        items: {
          carryQty,
          haloVariantIds,
          additionalLinkQty: linkQty,
        },
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
  }, [carryQty, courier, haloVariantIds, linkQty, selectedDestination, step]);

  const toggleHalo = (variantId: string) => {
    setHaloVariantIds((current) => (current.includes(variantId) ? current.filter((id) => id !== variantId) : [...current, variantId]));
  };

  const continueToInformation = () => {
    if (subtotal === 0) return;
    setSubmitError("");
    setStep("information");
  };

  const searchDestinations = async () => {
    if (destinationQuery.trim().length < 2) {
      setShippingError("Enter at least 2 characters to search your destination.");
      return;
    }

    setIsSearchingDestinations(true);
    setShippingError("");
    setDestinationOptions([]);
    try {
      const response = await fetch(`/api/shipping/destinations?q=${encodeURIComponent(destinationQuery.trim())}`, { cache: "no-store" });
      const payload = (await response.json()) as { destinations?: ShippingDestination[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to search destinations.");
      setDestinationOptions(payload.destinations ?? []);
    } catch (error) {
      setShippingError(error instanceof Error ? error.message : "Unable to search destinations.");
    } finally {
      setIsSearchingDestinations(false);
    }
  };

  const submitInformation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDestination) {
      setShippingError("Select your destination from the search results.");
      return;
    }
    if (!selectedRate) {
      setShippingError("Select a shipping service before reviewing your reservation.");
      return;
    }
    setSubmitError("");
    setStep("review");
  };

  const createReservation = async () => {
    if (!selectedDestination || !selectedRate) return;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          destination: selectedDestination,
          shipping: selectedRate,
          courier,
          items: { carryQty, haloVariantIds, additionalLinkQty: linkQty },
        }),
      });
      const payload = (await response.json()) as OrderResponse;
      if (!response.ok || !payload.orderNumber || !payload.expiresAt || typeof payload.paymentAmount !== "number") {
        throw new Error(payload.error || "Could not create your reservation.");
      }
      setReservation({ orderNumber: payload.orderNumber, expiresAt: payload.expiresAt, paymentAmount: payload.paymentAmount });
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
        body: JSON.stringify({ orderNumber: reservation.orderNumber }),
      });
      const payload = (await response.json()) as PaymentResponse;
      if (!response.ok || !payload.token) throw new Error(payload.error || "Could not start payment.");
      if (window.snap) {
        window.snap.pay(payload.token, {
          onSuccess: () => router.push(`/checkout/status?order=${encodeURIComponent(reservation.orderNumber)}`),
          onPending: () => router.push(`/checkout/status?order=${encodeURIComponent(reservation.orderNumber)}`),
          onError: () => setPaymentError("Payment could not be completed. Your reservation is still active until the deadline above."),
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
        <div className="mb-10 flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between"><div><p className="visr-label text-white/40">VISR Private Reservation</p><h1 className="mt-4 max-w-3xl text-4xl tracking-[-0.04em] md:text-6xl">Complete your Batch 2 reservation.</h1></div><p className="max-w-md text-sm leading-6 text-white/45">Stock is reserved for 30 minutes after confirmation. Shipping is calculated from Bandung through RajaOngkir.</p></div>
        <div className="grid gap-10 lg:grid-cols-[1fr_390px]">
          <section>
            {step === "products" && <div className="space-y-6">
              <article className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-7 md:p-9"><div className="flex items-start justify-between gap-6"><div><p className="visr-label text-white/40">Core System</p><h2 className="mt-3 text-2xl">{products.carry.name}</h2><p className="mt-3 text-sm text-white/45">Includes 1 VISR Link · 325 g product weight</p></div><p className="text-lg">{formatRupiah(products.carry.price)}</p></div><div className="mt-7 flex items-center justify-between border-t border-white/10 pt-6"><p className="text-xs text-white/35">{products.carry.stock} available</p><QuantityControl value={carryQty} max={products.carry.stock} onChange={setCarryQty} /></div></article>
              <article className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-7 md:p-9"><div className="flex items-start justify-between gap-6"><div><p className="visr-label text-white/40">Halo Collection</p><h2 className="mt-3 text-2xl">Choose your halo.</h2><p className="mt-3 text-sm text-white/45">Each Halo is 150 g. One per color per reservation.</p></div><p className="text-lg">{formatRupiah(products.halo.price)}</p></div><div className="mt-7 grid gap-3 sm:grid-cols-2">{products.halo.variants.map((variant) => { const selected = haloVariantIds.includes(variant.id); return <button key={variant.id} type="button" disabled={variant.stock === 0} onClick={() => toggleHalo(variant.id)} className={`rounded-2xl border p-5 text-left transition ${selected ? "border-white bg-white text-black" : "border-white/10 bg-black/20 hover:border-white/30"} disabled:cursor-not-allowed disabled:opacity-30`}><span className="block text-base">{variant.name}</span><span className={`mt-2 block text-xs ${selected ? "text-black/55" : "text-white/35"}`}>{variant.stock} available</span></button>; })}</div></article>
              <article className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-7 md:p-9"><div className="flex items-start justify-between gap-6"><div><p className="visr-label text-white/40">Optional Add-on</p><h2 className="mt-3 text-2xl">Additional VISR Link</h2><p className="mt-3 text-sm text-white/45">25 g each · for wall, desk, and future VISR systems.</p></div><p className="text-lg">{formatRupiah(products.additionalLink.price)}</p></div><div className="mt-7 flex items-center justify-between border-t border-white/10 pt-6"><p className="text-xs text-white/35">{products.additionalLink.stock} available</p><QuantityControl value={linkQty} max={products.additionalLink.stock} onChange={setLinkQty} /></div></article>
            </div>}

            {step === "information" && <form onSubmit={submitInformation} className="mt-12 space-y-8">
              <div><p className="visr-label text-white/40">Information</p><h2 className="mt-3 text-3xl">Where should we send your VISR?</h2></div>
              <div className="grid gap-4 md:grid-cols-2"><TextField label="Full name" value={customer.fullName} onChange={(value) => setCustomer({ ...customer, fullName: value })} required /><TextField label="WhatsApp" value={customer.whatsapp} onChange={(value) => setCustomer({ ...customer, whatsapp: value.replace(/\D/g, "") })} required /><TextField label="Email" type="email" value={customer.email} onChange={(value) => setCustomer({ ...customer, email: value })} required /><TextField label="Postal code" value={customer.postalCode} onChange={(value) => setCustomer({ ...customer, postalCode: value.replace(/\D/g, "") })} required /></div>
              <TextField label="Street address" value={customer.address} onChange={(value) => setCustomer({ ...customer, address: value })} required />
              <div className="rounded-[2rem] border border-white/10 p-6"><p className="visr-label text-white/40">Destination Search</p><div className="mt-4 flex gap-3"><input value={destinationQuery} onChange={(event) => setDestinationQuery(event.target.value)} placeholder="City, district, or postal code" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-white/35" /><button type="button" onClick={searchDestinations} disabled={isSearchingDestinations} className="rounded-2xl border border-white/15 px-5 text-sm disabled:opacity-50">{isSearchingDestinations ? "Searching…" : "Search"}</button></div>{destinationOptions.length > 0 && <div className="mt-4 space-y-2">{destinationOptions.map((destination) => <button key={destination.id} type="button" onClick={() => { setSelectedDestination(destination); setCustomer({ ...customer, province: destination.province, city: destination.city, district: destination.district || "", postalCode: destination.postalCode || customer.postalCode }); setDestinationOptions([]); }} className={`w-full rounded-2xl border p-4 text-left text-sm ${selectedDestination?.id === destination.id ? "border-white bg-white text-black" : "border-white/10 bg-black/20"}`}>{destination.label}</button>)}</div>}{selectedDestination && <p className="mt-4 text-sm text-white/55">Selected: {selectedDestination.label}</p>}<p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-white/28">Powered by RajaOngkir</p></div>
              <div className="grid gap-4 md:grid-cols-3"><TextField label="Province" value={customer.province} onChange={(value) => setCustomer({ ...customer, province: value })} required /><TextField label="City" value={customer.city} onChange={(value) => setCustomer({ ...customer, city: value })} required /><TextField label="District" value={customer.district} onChange={(value) => setCustomer({ ...customer, district: value })} /></div>
              <div className="rounded-[2rem] border border-white/10 p-6"><p className="visr-label text-white/40">Courier</p><div className="mt-4 grid grid-cols-2 gap-3">{(["jne", "jnt"] as CheckoutCourier[]).map((item) => <button key={item} type="button" onClick={() => setCourier(item)} className={`rounded-2xl border p-4 text-sm ${courier === item ? "border-white bg-white text-black" : "border-white/10 bg-black/20"}`}>{item === "jne" ? "JNE" : "J&T Express"}</button>)}</div><div className="mt-5 space-y-3">{isLoadingRates && <p className="text-sm text-white/40">Calculating shipping…</p>}{rates.map((rate) => <button key={`${rate.courier}-${rate.service}-${rate.costIdr}`} type="button" onClick={() => setSelectedRate(rate)} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${selectedRate?.service === rate.service && selectedRate?.courier === rate.courier ? "border-white bg-white text-black" : "border-white/10 bg-black/20"}`}><span><span className="block text-sm">{courierLabel(rate)}</span><span className={`mt-1 block text-xs ${selectedRate?.service === rate.service ? "text-black/55" : "text-white/35"}`}>{rate.etd ? `${rate.etd} days` : "Estimated delivery shown by courier"}</span></span><span>{formatRupiah(rate.costIdr)}</span></button>)}</div></div>
              <label className="block"><span className="mb-2 block text-xs uppercase tracking-[0.16em] text-white/35">Order notes</span><textarea value={customer.orderNotes} onChange={(event) => setCustomer({ ...customer, orderNotes: event.target.value })} rows={4} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-white/35" /></label>
              {shippingError && <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-200">{shippingError}</div>}
              <div className="flex gap-3"><button type="button" onClick={() => setStep("products")} className="rounded-full border border-white/15 px-6 py-4 text-sm">Back</button><button type="submit" className="flex-1 rounded-full bg-white px-6 py-4 text-sm font-medium text-black">Review Reservation</button></div>
            </form>}

            {step === "review" && <div className="mt-12 space-y-8">
              <div className="rounded-[2rem] border border-white/10 p-7"><p className="visr-label text-white/40">Customer</p><p className="mt-5 text-xl">{customer.fullName}</p><p className="mt-2 text-sm leading-6 text-white/50">+{customer.whatsapp}<br />{customer.email}<br />{customer.address}, {customer.city}, {customer.province} {customer.postalCode}</p>{customer.orderNotes && <p className="mt-4 text-sm text-white/40">Note: {customer.orderNotes}</p>}</div>
              {selectedDestination && selectedRate && <div className="rounded-[2rem] border border-white/10 p-7"><p className="visr-label text-white/40">Shipping</p><p className="mt-5 text-xl">{courierLabel(selectedRate)}</p><p className="mt-2 text-sm leading-6 text-white/50">{selectedDestination.label}<br />{selectedRate.etd ? `${selectedRate.etd} day estimate · ` : ""}{formatRupiah(selectedRate.costIdr)}</p></div>}
              {submitError && <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm leading-6 text-red-200">{submitError}</div>}
              <div className="flex gap-3"><button type="button" onClick={() => setStep("information")} disabled={isSubmitting} className="rounded-full border border-white/15 px-6 py-4 text-sm disabled:opacity-40">Edit Information</button><button type="button" onClick={createReservation} disabled={isSubmitting || !selectedRate} className="flex-1 rounded-full bg-white px-6 py-4 text-sm font-medium text-black disabled:cursor-wait disabled:opacity-55">{isSubmitting ? "Reserving stock…" : "Create Reservation"}</button></div>
            </div>}

            {step === "reserved" && reservation && <div className="mt-12 rounded-[2rem] border border-white/12 bg-white/[0.035] p-7 md:p-10"><p className="visr-label text-white/40">Reservation Confirmed</p><p className="mt-6 text-sm text-white/45">Your order number</p><p className="mt-2 break-all text-2xl tracking-[-0.03em] md:text-4xl">{reservation.orderNumber}</p><p className="mt-8 max-w-xl text-sm leading-7 text-white/55">Your selected stock is held until {new Date(reservation.expiresAt).toLocaleString("en-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB. Complete payment before this deadline to secure your Batch 2 reservation.</p>{paymentError && <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm leading-6 text-red-200">{paymentError}</div>}<button type="button" onClick={payReservation} disabled={isPaying} className="mt-8 w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition hover:bg-white/85 disabled:cursor-wait disabled:opacity-55">{isPaying ? "Opening secure payment…" : `Pay ${formatRupiah(grandTotal)} with Midtrans`}</button><p className="mt-5 text-xs leading-5 text-white/32">Save this order number. Midtrans will handle the payment securely, while the webhook confirms the final payment status.</p></div>}
          </section>

          <aside className="lg:sticky lg:top-8 lg:self-start"><div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-7 md:p-9"><p className="visr-label text-white/42">Reservation Summary</p><div className="mt-8 space-y-5 text-sm">{carryQty > 0 && <div className="flex justify-between gap-4"><span>VISR Carry Gen 2 × {carryQty}</span><span>{formatRupiah(carryQty * products.carry.price)}</span></div>}{selectedHalo.map((variant) => (<div key={variant.id} className="flex justify-between gap-4"><span>{variant.name}</span><span>{formatRupiah(products.halo.price)}</span></div>))}{linkQty > 0 && <div className="flex justify-between gap-4"><span>Additional VISR Link × {linkQty}</span><span>{formatRupiah(linkQty * products.additionalLink.price)}</span></div>}</div><div className="mt-8 space-y-3 border-t border-white/10 pt-6"><div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatRupiah(subtotal)}</span></div><div className="flex justify-between text-sm"><span>Shipping{selectedRate ? ` · ${courierLabel(selectedRate)}` : ""}</span><span>{selectedRate ? formatRupiah(shippingCost) : "—"}</span></div><div className="flex justify-between border-t border-white/10 pt-4 text-lg"><span>Total</span><span>{formatRupiah(grandTotal)}</span></div></div><div className="mt-8 rounded-2xl bg-white/[0.05] p-5 text-xs leading-5 text-white/50"><p>{packing.actualWeightGrams.toLocaleString("en-ID")} g actual weight</p><p>{packing.lengthCm} × {packing.widthCm} × {packing.heightCm} cm packing profile</p><p>Chargeable weight is validated per courier.</p></div>{step === "products" && <button type="button" onClick={continueToInformation} disabled={subtotal === 0} className="mt-7 w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-30">Continue to Information</button>}<p className="mt-5 text-center text-xs text-white/32">Payments are verified server-side through Midtrans notifications.</p></div></aside>
        </div>
      </div>
    </main>
  );
}

function QuantityControl({ value, max, onChange }: { value: number; max: number; onChange: (value: number) => void }) {
  return <div className="flex items-center rounded-full border border-white/12"><button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="px-4 py-2 text-lg">−</button><span className="min-w-10 text-center text-sm">{value}</span><button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="px-4 py-2 text-lg">+</button></div>;
}

function TextField({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <label className="block"><span className="mb-2 block text-xs uppercase tracking-[0.16em] text-white/35">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-white/35" /></label>;
}
