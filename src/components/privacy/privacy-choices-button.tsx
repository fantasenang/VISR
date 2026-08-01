"use client";

import { PRIVACY_CHOICES_OPEN_EVENT } from "@/lib/privacy/consent";

export function PrivacyChoicesButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(PRIVACY_CHOICES_OPEN_EVENT))}
      className={className}
    >
      Privacy Choices
    </button>
  );
}
