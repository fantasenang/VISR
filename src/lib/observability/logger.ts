type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const SENSITIVE_KEYS = /authorization|cookie|token|secret|password|server.?key|service.?role|signature|raw.?payload|address|whatsapp|phone|email/i;

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

function sanitizeValue(key: string, value: unknown): unknown {
  if (value == null) return value;
  if (SENSITIVE_KEYS.test(key)) {
    if (typeof value === "string" && key.toLowerCase().includes("email")) return maskEmail(value);
    if (typeof value === "string" && /(whatsapp|phone)/i.test(key)) return maskPhone(value);
    return "[REDACTED]";
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(key, item));
  if (typeof value === "object") return sanitizeContext(value as LogContext);
  if (typeof value === "string" && value.length > 1000) return `${value.slice(0, 1000)}...[TRUNCATED]`;
  return value;
}

export function sanitizeContext(context: LogContext = {}) {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [key, sanitizeValue(key, value)]));
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
