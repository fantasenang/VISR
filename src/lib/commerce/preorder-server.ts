import { getPreorderPhase, type PreorderPhase } from "@/lib/commerce/preorder";

export function isPreorderPreviewOverride() {
  return process.env.VERCEL_ENV === "preview";
}

export function getServerPreorderPhase(now = Date.now()): PreorderPhase {
  if (isPreorderPreviewOverride()) return "open";
  return getPreorderPhase(now);
}
