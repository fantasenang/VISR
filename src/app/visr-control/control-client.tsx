"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AuthStatus = {
  configured: boolean;
  authenticated: boolean;
  owner: { username: string; recoveryEmail: string };
};

type AdminProduct = {
  id: string;
  sku: string;
  name: string;
  variantName: string | null;
  priceIdr: number;
  stockTotal: number;
  stockReserved: number;
  stockSold: number;
  remaining: number;
  maxPerOrder: number;
  isActive: boolean;
  updatedAt: string;
};

type AdminOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  whatsapp: string;
  address: string;
  province: string;
  city: string;
  postalCode: string;
  notes: string | null;
  subtotalIdr: number;
  shippingCostIdr: number;
  totalIdr: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentExpiresAt: string;
  paidAt: string | null;
  createdAt: string;
  items: Array<{ sku: string; name: string; variantName: string | null; quantity: number }>;
  shipment: {
    courier: string | null;
    service: string | null;
    trackingNumber: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  } | null;
};

type DashboardData = {
  overview: {
    totalOrders: number;
    pendingPayment: number;
    paidOrders: number;
    needsAction: number;
    shippedOrders: number;
    revenueIdr: number;
    lowStockProducts: number;
  };
  orders: AdminOrder[];
  products: AdminProduct[];
};

type ApiError = { error?: { message?: string } };
type Tab = "overview" | "orders" | "products";

const fulfillmentStatuses = ["pending", "confirmed", "production", "qc", "packing", "shipped", "delivered"];

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...(init.headers ?? {}) } : init?.headers,
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) throw new Error(payload.error?.message ?? "Request failed.");
  return payload;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition focus:border-white/30";
const buttonClass = "rounded-full border border-white/15 px-5 py-3 text-sm transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40";

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#030303] px-5 py-10 text-[#f5f5f2] sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-lg flex-col justify-center">
        <div className="mb-10 flex items-center justify-between border-b border-white/10 pb-5">
          <span className="text-sm tracking-[0.24em]">VISR</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">Control</span>
        </div>
        {children}
      </div>
    </main>
  );
}

function SetupScreen({ status, onComplete }: { status: AuthStatus; onComplete: () => Promise<void> }) {
  const [setupCode, setSetupCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirm) return setError("Konfirmasi password tidak sama.");
    setBusy(true);
    try {
      await requestJson("/api/admin/auth/setup", {
        method: "POST",
        body: JSON.stringify({
          username: status.owner.username,
          recoveryEmail: status.owner.recoveryEmail,
          setupCode,
          password,
        }),
      });
      await onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Setup gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Owner activation</p>
      <h1 className="mt-5 text-4xl font-normal tracking-[-0.05em]">Activate VISR Control.</h1>
      <p className="mt-5 text-sm leading-6 text-white/48">Setup ini hanya bisa dijalankan satu kali. Setelah berhasil, halaman ini otomatis terkunci.</p>
      <form onSubmit={submit} className="mt-9 space-y-5">
        <Field label="Nama akun"><input className={inputClass} value={status.owner.username} readOnly /></Field>
        <Field label="Recovery email"><input className={inputClass} value={status.owner.recoveryEmail} readOnly /></Field>
        <Field label="Setup code"><input className={inputClass} value={setupCode} onChange={(event) => setSetupCode(event.target.value)} autoComplete="one-time-code" required /></Field>
        <Field label="Password baru"><input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required /></Field>
        <Field label="Konfirmasi password"><input className={inputClass} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={12} required /></Field>
        <p className="text-xs leading-5 text-white/35">Minimal 12 karakter, dengan huruf besar, huruf kecil, dan angka.</p>
        {error ? <p className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p> : null}
        <button className={`${buttonClass} w-full`} disabled={busy}>{busy ? "Activating…" : "Activate owner account"}</button>
      </form>
    </AuthShell>
  );
}

function LoginScreen({ username, onComplete }: { username: string; onComplete: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestJson("/api/admin/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      await onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Private operations</p>
      <h1 className="mt-5 text-4xl font-normal tracking-[-0.05em]">Enter VISR Control.</h1>
      <form onSubmit={submit} className="mt-9 space-y-5">
        <Field label="Nama akun"><input className={inputClass} value={username} readOnly /></Field>
        <Field label="Password"><input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required autoFocus /></Field>
        {error ? <p className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p> : null}
        <button className={`${buttonClass} w-full`} disabled={busy}>{busy ? "Checking…" : "Enter VISR Control"}</button>
      </form>
    </AuthShell>
  );
}

function OrderEditor({ order, onSaved }: { order: AdminOrder; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState(order.fulfillmentStatus);
  const [tracking, setTracking] = useState(order.shipment?.trackingNumber ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await requestJson("/api/admin/orders", {
        method: "PATCH",
        body: JSON.stringify({ id: order.id, fulfillmentStatus: status, trackingNumber: tracking.trim() || null }),
      });
      setMessage("Saved");
      await onSaved();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-white/45">{order.orderNumber}</p>
          <h3 className="mt-2 text-xl tracking-[-0.03em]">{order.customerName}</h3>
          <p className="mt-1 text-xs text-white/38">{dateTime(order.createdAt)}</p>
        </div>
        <div className="text-right">
          <p className="text-lg">{rupiah(order.totalIdr)}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/42">{order.paymentStatus}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-5 border-t border-white/8 pt-5 md:grid-cols-2">
        <div className="space-y-2 text-sm text-white/58">
          <p>{order.items.map((item) => `${item.quantity}× ${item.variantName ?? item.name}`).join(" · ") || "No item detail"}</p>
          <p>{order.address}, {order.city}, {order.province} {order.postalCode}</p>
          <a className="block w-fit text-white/80 underline decoration-white/20 underline-offset-4" href={`https://wa.me/${order.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Open WhatsApp</a>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fulfillment">
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              {fulfillmentStatuses.map((value) => <option key={value} value={value} className="bg-black">{value}</option>)}
            </select>
          </Field>
          <Field label="Tracking number"><input className={inputClass} value={tracking} onChange={(event) => setTracking(event.target.value)} /></Field>
          <button className={`${buttonClass} sm:col-span-2`} onClick={save} disabled={busy}>{busy ? "Saving…" : "Save order"}</button>
          {message ? <p className="text-xs text-white/45 sm:col-span-2">{message}</p> : null}
        </div>
      </div>
    </article>
  );
}

function ProductEditor({ product, onSaved }: { product: AdminProduct; onSaved: () => Promise<void> }) {
  const [price, setPrice] = useState(String(product.priceIdr));
  const [stock, setStock] = useState(String(product.stockTotal));
  const [maxPerOrder, setMaxPerOrder] = useState(String(product.maxPerOrder));
  const [active, setActive] = useState(product.isActive);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await requestJson("/api/admin/products", {
        method: "PATCH",
        body: JSON.stringify({
          sku: product.sku,
          priceIdr: Number(price),
          stockTotal: Number(stock),
          maxPerOrder: Number(maxPerOrder),
          isActive: active,
        }),
      });
      setMessage("Saved");
      await onSaved();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-start justify-between gap-4">
        <div><p className="font-mono text-xs text-white/38">{product.sku}</p><h3 className="mt-2 text-xl">{product.variantName ?? product.name}</h3></div>
        <div className="text-right"><p className="text-2xl">{product.remaining}</p><p className="text-[10px] uppercase tracking-[0.15em] text-white/35">available</p></div>
      </div>
      <div className="mt-5 grid gap-4 border-t border-white/8 pt-5 sm:grid-cols-3">
        <Field label="Price IDR"><input className={inputClass} inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))} /></Field>
        <Field label="Total stock"><input className={inputClass} inputMode="numeric" value={stock} onChange={(event) => setStock(event.target.value.replace(/\D/g, ""))} /></Field>
        <Field label="Max / order"><input className={inputClass} inputMode="numeric" value={maxPerOrder} onChange={(event) => setMaxPerOrder(event.target.value.replace(/\D/g, ""))} /></Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-white/42">
        <span>Reserved {product.stockReserved} · Sold {product.stockSold}</span>
        <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label>
      </div>
      <button className={`${buttonClass} mt-5 w-full`} onClick={save} disabled={busy}>{busy ? "Saving…" : "Save product"}</button>
      {message ? <p className="mt-3 text-xs text-white/45">{message}</p> : null}
    </article>
  );
}

function Dashboard({ data, refresh, logout }: { data: DashboardData; refresh: () => Promise<void>; logout: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState("all");
  const filteredOrders = useMemo(() => filter === "all" ? data.orders : data.orders.filter((order) => order.paymentStatus === filter || order.fulfillmentStatus === filter), [data.orders, filter]);
  const cards = [
    ["Orders", data.overview.totalOrders], ["Pending payment", data.overview.pendingPayment], ["Paid", data.overview.paidOrders],
    ["Needs action", data.overview.needsAction], ["Shipped", data.overview.shippedOrders], ["Revenue", rupiah(data.overview.revenueIdr)],
  ];

  return (
    <main className="min-h-screen bg-[#030303] px-4 py-6 text-[#f5f5f2] sm:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-6">
          <div><p className="text-sm tracking-[0.24em]">VISR</p><h1 className="mt-2 text-3xl tracking-[-0.045em]">Control</h1></div>
          <div className="flex gap-3"><button className={buttonClass} onClick={refresh}>Refresh</button><button className={buttonClass} onClick={logout}>Logout</button></div>
        </header>
        <nav className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {(["overview", "orders", "products"] as Tab[]).map((value) => <button key={value} onClick={() => setTab(value)} className={`rounded-full px-5 py-2.5 text-sm capitalize ${tab === value ? "bg-white text-black" : "border border-white/10 text-white/55"}`}>{value}</button>)}
        </nav>

        {tab === "overview" ? (
          <section className="mt-7">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</p><p className="mt-4 text-3xl tracking-[-0.04em]">{value}</p></div>)}</div>
            <div className="mt-8 rounded-2xl border border-white/10 p-5"><p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Stock attention</p><p className="mt-4 text-4xl">{data.overview.lowStockProducts}</p><p className="mt-2 text-sm text-white/45">active products with five or fewer units available</p></div>
          </section>
        ) : null}

        {tab === "orders" ? (
          <section className="mt-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl">Orders</h2><select className={`${inputClass} w-auto min-w-44`} value={filter} onChange={(event) => setFilter(event.target.value)}><option className="bg-black" value="all">All orders</option><option className="bg-black" value="pending">Pending payment</option><option className="bg-black" value="paid">Paid</option><option className="bg-black" value="production">Production</option><option className="bg-black" value="packing">Packing</option><option className="bg-black" value="shipped">Shipped</option><option className="bg-black" value="delivered">Delivered</option></select></div>
            <div className="space-y-4">{filteredOrders.map((order) => <OrderEditor key={order.id} order={order} onSaved={refresh} />)}{filteredOrders.length === 0 ? <p className="py-16 text-center text-white/35">No orders in this filter.</p> : null}</div>
          </section>
        ) : null}

        {tab === "products" ? (
          <section className="mt-7"><div className="mb-5"><h2 className="text-2xl">Products & stock</h2><p className="mt-2 text-sm text-white/42">Reserved and sold values follow transactions and cannot be edited manually.</p></div><div className="grid gap-4 lg:grid-cols-2">{data.products.map((product) => <ProductEditor key={product.id} product={product} onSaved={refresh} />)}</div></section>
        ) : null}
      </div>
    </main>
  );
}

export default function ControlClient() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  async function loadDashboard() {
    const dashboard = await requestJson<DashboardData>("/api/admin/dashboard");
    setData(dashboard);
  }

  async function loadStatus() {
    setError("");
    try {
      const nextStatus = await requestJson<AuthStatus>("/api/admin/auth/status");
      setStatus(nextStatus);
      if (nextStatus.authenticated) await loadDashboard();
      else setData(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "VISR Control unavailable.");
    }
  }

  async function logout() {
    await requestJson("/api/admin/auth/logout", { method: "POST" });
    await loadStatus();
  }

  useEffect(() => { void loadStatus(); }, []);

  if (error) return <AuthShell><h1 className="text-3xl">VISR Control unavailable.</h1><p className="mt-4 text-sm text-white/48">{error}</p><button className={`${buttonClass} mt-7`} onClick={() => void loadStatus()}>Try again</button></AuthShell>;
  if (!status) return <AuthShell><p className="animate-pulse text-sm text-white/40">Opening VISR Control…</p></AuthShell>;
  if (!status.configured) return <SetupScreen status={status} onComplete={loadStatus} />;
  if (!status.authenticated) return <LoginScreen username={status.owner.username} onComplete={loadStatus} />;
  if (!data) return <AuthShell><p className="animate-pulse text-sm text-white/40">Loading operations…</p></AuthShell>;
  return <Dashboard data={data} refresh={loadDashboard} logout={logout} />;
}
