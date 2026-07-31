export const PREORDER_START_ISO = "2026-08-06T17:00:00.000Z";
export const PREORDER_END_ISO = "2026-08-13T17:00:00.000Z";
export const PREORDER_LIMIT = 100;

export type PreorderPhase = "upcoming" | "open" | "closed";

export function getPreorderPhase(now = Date.now()): PreorderPhase {
  const start = Date.parse(PREORDER_START_ISO);
  const end = Date.parse(PREORDER_END_ISO);
  if (now < start) return "upcoming";
  if (now >= end) return "closed";
  return "open";
}

export function getPreorderTarget(phase: PreorderPhase) {
  return phase === "upcoming" ? Date.parse(PREORDER_START_ISO) : Date.parse(PREORDER_END_ISO);
}
