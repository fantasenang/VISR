import { getAdminSession } from "@/lib/admin/auth";
import {
  PREORDER_END_ISO,
  PREORDER_START_ISO,
  getPreorderPhase,
  type PreorderPhase,
} from "@/lib/commerce/preorder";

export async function isPreorderPreviewOverride() {
  return true;
}

export function getServerPreorderPhase(now = Date.now()): PreorderPhase {
  if (process.env.VERCEL_ENV === "preview") return "open";
  return getPreorderPhase(now);
}

export async function getPreorderApiAccess(now = Date.now()) {
  const phase = getPreorderPhase(now);
  if (phase === "open") return { allowed: true, phase, preview: false } as const;
  const preview = await isPreorderPreviewOverride();
  return { allowed: preview, phase, preview } as const;
}

export function wasCreatedDuringOfficialPreorder(createdAt: string) {
  const timestamp = Date.parse(createdAt);
  return (
    Number.isFinite(timestamp) &&
    timestamp >= Date.parse(PREORDER_START_ISO) &&
    timestamp < Date.parse(PREORDER_END_ISO)
  );
}
