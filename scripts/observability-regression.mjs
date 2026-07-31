import { readFile } from "node:fs/promises";

const files = {
  webhook: "src/app/api/payments/midtrans/webhook/route.ts",
  observability: "docs/operations/observability.md",
  alerts: "docs/operations/alerts.json",
  incident: "docs/operations/incident-runbook.md",
  recovery: "docs/operations/backup-recovery.md",
};

const content = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([name, path]) => [name, await readFile(path, "utf8")]),
  ),
);

const requiredWebhookSignals = [
  "MIDTRANS_WEBHOOK_APPLIED",
  "MIDTRANS_WEBHOOK_INVALID_SIGNATURE",
  "MIDTRANS_WEBHOOK_AMOUNT_MISMATCH",
  "MIDTRANS_WEBHOOK_UPDATE_FAILED",
  "durationMs",
  "requestId",
];

const failures = [];

for (const signal of requiredWebhookSignals) {
  if (!content.webhook.includes(signal)) failures.push(`Webhook telemetry is missing ${signal}`);
}

const alertPolicy = JSON.parse(content.alerts);
if (!Array.isArray(alertPolicy.rules) || alertPolicy.rules.length < 5) {
  failures.push("Alert policy must contain at least five launch rules");
}

for (const phrase of ["service objectives", "Dashboard panels", "Correlation workflow"]) {
  if (!content.observability.toLowerCase().includes(phrase.toLowerCase())) {
    failures.push(`Observability guide is missing ${phrase}`);
  }
}

for (const phrase of ["First 10 minutes", "Payment incident rules", "Recovery validation"]) {
  if (!content.incident.includes(phrase)) failures.push(`Incident runbook is missing ${phrase}`);
}

for (const phrase of ["Recovery objectives", "Restore procedure", "Restore drill"]) {
  if (!content.recovery.includes(phrase)) failures.push(`Backup playbook is missing ${phrase}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log("Observability regression checks passed.");
