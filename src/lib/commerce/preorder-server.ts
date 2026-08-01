import { getAdminSession } from "@/lib/admin/auth";
import { getPreorderPhase, type PreorderPhase } from "@/lib/commerce/preorder";

export async function isPreorderPreviewOverride() {
  if (process.env.VERCEL_ENV === "preview") return true;
  return Boolean(await getAdminSession());
}

export function getServerPreorderPhase(now = Date.now()): PreorderPhase {
  if (process.env.VERCEL_ENV === "preview") return "open";
  return getPreorderPhase(now);
}
