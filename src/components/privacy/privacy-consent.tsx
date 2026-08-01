"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  TRACKING_CONSENT_COOKIE,
  TRACKING_CONSENT_EVENT,
  TRACKING_CONSENT_STORAGE_KEY,
  isTrackingConsent,
  type TrackingConsent,
} from "@/lib/privacy/consent";

function readStoredConsent(): TrackingConsent | null {
  try {
    const stored = window.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY);
    if (isTrackingConsent(stored)) return stored;
  } catch {
    // Storage can be unavailable in strict privacy modes.
  }

  const cookieValue = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TRACKING_CONSENT_COOKIE}=`))
    ?.slice(TRACKING_CONSENT_COOKIE.length + 1);

  return isTrackingConsent(cookieValue) ? cookieValue : null;
}

function persistConsent(choice: TrackingConsent) {
  try {
    window.localStorage.setItem(TRACKING_CONSENT_STORAGE_KEY, choice);
  } catch {
    // The first-party cookie remains the server-readable fallback.
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TRACKING_CONSENT_COOKIE}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  window.dispatchEvent(
    new CustomEvent(TRACKING_CONSENT_EVENT, { detail: { choice } }),
  );
}

export function PrivacyConsent() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<TrackingConsent | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = readStoredConsent();
    setChoice(stored);
    setOpen(stored === null);
    setReady(true);
  }, []);

  function choose(nextChoice: TrackingConsent) {
    persistConsent(nextChoice);
    setChoice(nextChoice);
    setOpen(false);
  }

  if (!ready || pathname.startsWith("/visr-control")) return null;

  return (
    <>
      {open ? (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="visr-privacy-title"
          className="fixed inset-x-3 bottom-3 z-[120] mx-auto max-w-xl rounded-[1.6rem] border border-white/15 bg-[#080808]/[0.97] p-5 text-white shadow-[0_20px_80px_rgb(0_0_0/0.72)] backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:p-6"
        >
          <p className="visr-label text-white/40">Privacy choices</p>
          <h2 id="visr-privacy-title" className="mt-3 text-xl tracking-[-0.025em]">
            Keep VISR measurable—or essential only.
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/55">
            VISR uses essential storage for checkout. With permission, Meta and
            Vercel measurement help us understand visits, product interest, and
            completed purchases. Advertising measurement remains off until you
            allow it.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => choose("granted")}
              className="rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-white/85"
            >
              Allow measurement
            </button>
            <button
              type="button"
              onClick={() => choose("denied")}
              className="rounded-full border border-white/15 px-5 py-3 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Essential only
            </button>
          </div>
          <p className="mt-4 text-xs leading-5 text-white/35">
            You can change this choice later. Read the{" "}
            <Link href="/privacy" className="text-white/65 underline underline-offset-4">
              Privacy Notice
            </Link>
            .
          </p>
        </section>
      ) : (
        <div className="fixed bottom-3 left-3 z-[110] flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white/40 backdrop-blur-md sm:bottom-5 sm:left-5">
          <Link href="/privacy" className="transition hover:text-white/75">
            Privacy
          </Link>
          <span aria-hidden="true" className="text-white/15">·</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="transition hover:text-white/75"
          >
            Choices
          </button>
          <span className="sr-only">Current choice: {choice ?? "not selected"}</span>
        </div>
      )}
    </>
  );
}
