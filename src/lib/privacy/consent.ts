export const TRACKING_CONSENT_STORAGE_KEY = "visr_tracking_consent";
export const TRACKING_CONSENT_COOKIE = "visr_tracking_consent";
export const TRACKING_CONSENT_EVENT = "visr:tracking-consent";
export const META_CONSENT_MARKER = "[[VISR_META_MEASUREMENT_GRANTED]]";

const ORDER_NOTES_MAX_LENGTH = 500;

export type TrackingConsent = "granted" | "denied";

export function isTrackingConsent(value: unknown): value is TrackingConsent {
  return value === "granted" || value === "denied";
}

export function readTrackingConsentFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TRACKING_CONSENT_COOKIE}=`))
    ?.slice(TRACKING_CONSENT_COOKIE.length + 1);
  return isTrackingConsent(value) ? value : null;
}

export function stripInternalOrderMarkers(notes: string | null | undefined) {
  if (!notes) return "";
  return notes
    .replaceAll(META_CONSENT_MARKER, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function notesWithTrackingConsent(
  notes: string | null | undefined,
  granted: boolean,
) {
  const cleanNotes = stripInternalOrderMarkers(notes);
  if (!granted) return cleanNotes.slice(0, ORDER_NOTES_MAX_LENGTH);

  const separator = cleanNotes ? "\n" : "";
  const availableLength = Math.max(
    0,
    ORDER_NOTES_MAX_LENGTH - separator.length - META_CONSENT_MARKER.length,
  );
  const visibleNotes = cleanNotes.slice(0, availableLength).trimEnd();
  return visibleNotes
    ? `${visibleNotes}\n${META_CONSENT_MARKER}`
    : META_CONSENT_MARKER;
}

export function hasMetaMeasurementConsent(notes: string | null | undefined) {
  return Boolean(notes?.includes(META_CONSENT_MARKER));
}
