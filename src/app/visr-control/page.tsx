import ControlClient from "./control-client";
import { ADMIN_USERNAME, getAdminSession, isOwnerConfigured } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid_request: "Request aktivasi tidak valid. Muat ulang halaman lalu coba lagi.",
  rate_limited: "Terlalu banyak percobaan. Tunggu 15 menit sebelum mencoba lagi.",
  password_mismatch: "Konfirmasi password tidak sama.",
  invalid_password: "Password harus minimal 12 karakter dan memiliki huruf besar, huruf kecil, serta angka.",
  invalid_setup_code: "Setup code tidak valid. Gunakan kode terbaru yang diberikan.",
  activation_failed: "Aktivasi belum berhasil. Sistem tidak membuat akun apa pun; coba lagi setelah halaman dimuat ulang.",
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition focus:border-white/30";

function ActivationScreen({ error }: { error?: string }) {
  return (
    <main className="min-h-screen bg-[#030303] px-5 py-10 text-[#f5f5f2] sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-lg flex-col justify-center">
        <div className="mb-10 flex items-center justify-between border-b border-white/10 pb-5">
          <span className="text-sm tracking-[0.24em]">VISR</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">Control</span>
        </div>

        <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Owner activation</p>
        <h1 className="mt-5 text-4xl font-normal tracking-[-0.05em]">Activate VISR Control.</h1>
        <p className="mt-5 text-sm leading-6 text-white/48">
          Setup ini hanya bisa dijalankan satu kali. Setelah berhasil, halaman ini otomatis terkunci.
        </p>

        <form action="/visr-control/activate" method="post" className="mt-9 space-y-5">
          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">Nama akun</span>
            <input className={inputClass} value={ADMIN_USERNAME} readOnly />
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">Recovery email</span>
            <input className={inputClass} value="m•••••••••••@icloud.com" readOnly />
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">Setup code</span>
            <input className={inputClass} name="setupCode" autoComplete="one-time-code" required />
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">Password baru</span>
            <input
              className={inputClass}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">Konfirmasi password</span>
            <input
              className={inputClass}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>

          <p className="text-xs leading-5 text-white/35">
            Minimal 12 karakter, dengan huruf besar, huruf kecil, dan angka.
          </p>

          {error ? (
            <p className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">
              {errorMessages[error] ?? "Aktivasi belum berhasil. Muat ulang halaman lalu coba lagi."}
            </p>
          ) : null}

          <button className="w-full rounded-full border border-white/15 px-5 py-3 text-sm transition hover:bg-white hover:text-black">
            Activate owner account
          </button>
        </form>
      </div>
    </main>
  );
}

export default async function VisrControlPage({
  searchParams,
}: {
  searchParams: Promise<{ setup_error?: string }>;
}) {
  const configured = await isOwnerConfigured();
  if (configured) {
    const session = await getAdminSession();
    return (
      <>
        <ControlClient />
        {session ? (
          <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
            <a
              href="/visr-control/qris"
              className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black shadow-2xl transition hover:bg-white/85"
            >
              QRIS Verification
            </a>
            <a
              href="/visr-control/analytics"
              className="rounded-full border border-white/15 bg-black/80 px-5 py-3 text-sm text-white/70 shadow-2xl backdrop-blur-xl transition hover:bg-white hover:text-black"
            >
              Website Analytics
            </a>
          </div>
        ) : null}
      </>
    );
  }

  const params = await searchParams;
  return <ActivationScreen error={params.setup_error} />;
}
