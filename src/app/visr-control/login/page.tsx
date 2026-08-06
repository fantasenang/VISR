import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_USERNAME, getAdminSession } from "@/lib/admin/auth";
import {
  ADMIN_CHALLENGE_COOKIE,
  ADMIN_RECOVERY_DISPLAY_COOKIE,
  ensureTotpEnrollment,
  readAdminChallenge,
  readRecoveryDisplayToken,
} from "@/lib/admin/two-factor";

export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition focus:border-white/30";

const errors: Record<string, string> = {
  invalid_request: "Request login tidak valid. Muat ulang halaman lalu coba lagi.",
  invalid_credentials: "Nama akun atau password tidak valid.",
  invalid_code: "Kode authenticator atau recovery code tidak valid.",
  challenge_expired: "Sesi login sudah kedaluwarsa. Masukkan password lagi.",
  rate_limited: "Terlalu banyak percobaan. Tunggu sebelum mencoba lagi.",
  unavailable: "Sistem autentikasi sedang tidak tersedia.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#030303] px-5 py-10 text-[#f5f5f2] sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-lg flex-col justify-center">
        <div className="mb-10 flex items-center justify-between border-b border-white/10 pb-5">
          <span className="text-sm tracking-[0.24em]">VISR</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">Control / Secure Access</span>
        </div>
        {children}
      </div>
    </main>
  );
}

function ErrorMessage({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">
      {errors[code] ?? errors.unavailable}
    </p>
  );
}

export default async function ControlLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; new_owner?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const recoveryCodes = readRecoveryDisplayToken(cookieStore.get(ADMIN_RECOVERY_DISPLAY_COOKIE)?.value);

  if (recoveryCodes) {
    return (
      <Shell>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Recovery codes</p>
        <h1 className="mt-5 text-4xl tracking-[-0.05em]">Save these codes now.</h1>
        <p className="mt-5 text-sm leading-6 text-white/48">
          Setiap kode hanya dapat dipakai satu kali ketika authenticator tidak tersedia. Kode ini tidak akan ditampilkan lagi.
        </p>
        <div className="mt-7 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5 font-mono text-sm">
          {recoveryCodes.map((code) => <code key={code}>{code}</code>)}
        </div>
        <form action="/visr-control/login/continue" method="post" className="mt-7">
          <button className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-black">
            I have saved the codes
          </button>
        </form>
      </Shell>
    );
  }

  if (await getAdminSession()) redirect("/visr-control");

  const challenge = readAdminChallenge(cookieStore.get(ADMIN_CHALLENGE_COOKIE)?.value);
  if (!challenge) {
    return (
      <Shell>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Owner sign in</p>
        <h1 className="mt-5 text-4xl tracking-[-0.05em]">Open VISR Control.</h1>
        <p className="mt-5 text-sm leading-6 text-white/48">
          Password dan kode authenticator diperlukan untuk setiap sesi baru.
        </p>
        {params.new_owner ? (
          <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-white/60">
            Owner account aktif. Login untuk memasang authenticator.
          </p>
        ) : null}
        <form action="/visr-control/login/password" method="post" className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">Nama akun</span>
            <input className={inputClass} name="username" value={ADMIN_USERNAME} readOnly />
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">Password</span>
            <input className={inputClass} name="password" type="password" autoComplete="current-password" required maxLength={128} />
          </label>
          <ErrorMessage code={params.error} />
          <button className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-black">
            Continue securely
          </button>
        </form>
      </Shell>
    );
  }

  if (challenge.stage === "setup") {
    const enrollment = await ensureTotpEnrollment();
    return (
      <Shell>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">One-time setup</p>
        <h1 className="mt-5 text-4xl tracking-[-0.05em]">Protect the owner account.</h1>
        <p className="mt-5 text-sm leading-6 text-white/48">
          Tambahkan akun baru di aplikasi authenticator, pilih manual setup, lalu gunakan key berikut. Tipe kode: time-based, 6 digit.
        </p>
        <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">VISR setup key</p>
          <code className="mt-3 block break-all font-mono text-base tracking-[0.12em] text-white/85">{enrollment.secret}</code>
          <details className="mt-5 text-xs text-white/35">
            <summary className="cursor-pointer">Advanced authenticator URI</summary>
            <code className="mt-3 block break-all leading-5">{enrollment.uri}</code>
          </details>
        </div>
        <form action="/visr-control/login/verify" method="post" className="mt-7 space-y-5">
          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">6-digit code</span>
            <input className={inputClass} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus />
          </label>
          <ErrorMessage code={params.error} />
          <button className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-black">
            Activate two-factor security
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Second factor</p>
      <h1 className="mt-5 text-4xl tracking-[-0.05em]">Verify it is you.</h1>
      <p className="mt-5 text-sm leading-6 text-white/48">
        Masukkan kode 6 digit dari authenticator. Recovery code juga dapat digunakan.
      </p>
      <form action="/visr-control/login/verify" method="post" className="mt-8 space-y-5">
        <label className="block">
          <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">Authenticator or recovery code</span>
          <input className={inputClass} name="code" autoComplete="one-time-code" minLength={6} maxLength={32} required autoFocus />
        </label>
        <ErrorMessage code={params.error} />
        <button className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-black">
          Enter VISR Control
        </button>
      </form>
    </Shell>
  );
}
