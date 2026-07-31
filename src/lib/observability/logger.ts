type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const SENSITIVE_KEYS = /authorization|proxy-authorization|cookie|set-cookie|token|secret|password|passphrase|server.?key|service.?role|api.?key|signature|raw.?payload|address|whatsapp|phone|email|card|cvv|pin/i;
const SECRET_VALUE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /Basic\s+[A-Za-z0-9+/=]+/gi,
  /(?:sk|sb|pk)_[A-Za-z0-9_-]{12,}/g,
];

function maskEmail(value: string) {
  const [name, domain] = value.split("@");
  if (!domain) return "[REDACTED]";
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return "[REDACTED]";
  return `${digits.slice(0, 4)}******${digits.slice(-2)}`;
}

function redactSecretPatterns(value: string) {
  return SECRET_VALUE_PATTERNS.reduce((result, pattern) => result.replace(pattern, "[REDACTED]"), value);
}

function sanitizeValue(key: string, value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 6) return "[MAX_DEPTH]";
  if (SENSITIVE_KEYS.test(key)) {
    if (typeof value === "string" && key.toLowerCase().includes("email")) return maskEmail(value);
    if (typeof value === "string" && /(whatsapp|phone)/i.test(key)) return maskPhone(value);
    return "[REDACTED]";
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(key, item, depth + 1));
  if (typeof value === "object") return sanitizeContext(value as LogContext, depth + 1);
  if (typeof value === "string") {
    const redacted = redactSecretPatterns(value);
    return redacted.length > 1000 ? `${redacted.slice(0, 1000)}...[TRUNCATED]` : redacted;
  }
  return value;
}

export function sanitizeContext(context: LogContext = {}, depth = 0) {
  return Object.fromEntries(Object.entries(context).slice(0, 100).map(([key, value]) => [key, sanitizeValue(key, value, depth)]));
}

export function requestIdFrom(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function elapsedMs(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

export function log(level: LogLevel, event: string, context: LogContext = {}) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    event,
    ...sanitizeContext(context),
  });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);
}

export const logger = {
  info: (event: string, context?: LogContext) => log("info", event, context),
  warn: (event: string, context?: LogContext) => log("warn", event, context),
  error: (event: string, context?: LogContext) => log("error", event, context),
};
