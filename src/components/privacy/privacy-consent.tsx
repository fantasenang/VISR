"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  PRIVACY_CHOICES_OPEN_EVENT,
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
    setChoice(readStoredConsent());
    setReady(true);
  }, []);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(PRIVACY_CHOICES_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(PRIVACY_CHOICES_OPEN_EVENT, handleOpen);
  }, []);

  function choose(nextChoice: TrackingConsent) {
    persistConsent(nextChoice);
    setChoice(nextChoice);
    setOpen(false);
  }

  if (!ready || pathname.startsWith("/visr-control") || !open) return null;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="visr-privacy-title"
      className="fixed inset-x-3 bottom-3 z-[120] mx-auto max-w-xl rounded-[1.6rem] border border-white/15 bg-[#080808]/[0.97] p-5 text-white shadow-[0_20px_80px_rgb(0_0_0/0.72)] backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:p-6"
    >
      <p className="visr-label text-white/40">Privacy choices</p>
      <h2 id="visr-privacy-title" className="mt-3 text-xl tracking-[-0.025em]">
        Advertising measurement is optional.
      </h2>
      <p className="mt-3 text-sm leading-6 text-white/55">
        VISR uses anonymous, cookie-free Vercel Analytics to understand website
        traffic and performance. Meta advertising measurement remains off
        unless you explicitly allow it here.
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => choose("granted")}
          className="rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-white/85"
        >
          Allow Meta measurement
        </button>
        <button
          type="button"
          onClick={() => choose("denied")}
          className="rounded-full border border-white/15 px-5 py-3 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
        >
          Keep Meta off
        </button>
      </div>
      <p className="mt-4 text-xs leading-5 text-white/35">
        Current Meta choice: {choice === "granted" ? "allowed" : "off"}. Read the{" "}
        <Link href="/privacy" className="text-white/65 underline underline-offset-4">
          Privacy Notice
        </Link>
        .
      </p>
    </section>
  );
}
