# VISR Production Observability

## Scope

VISR uses structured JSON application logs as the canonical telemetry stream. Every operational event must carry a stable event name, severity, request ID where available, deployment context, and bounded duration fields. Secrets, authorization headers, payment signatures, service-role keys, and full customer payloads must never be logged.

## Core signals

### Availability

- `/api/health` must return HTTP 200 when required runtime configuration exists.
- `/api/ready` must return HTTP 200 only when the database and required commerce dependencies are ready.
- Production smoke tests must pass after deployment.

### Checkout and orders

Track counts and error ratios for order creation, order lookup, shipping quote, and Snap-token creation. Group failures by canonical error code rather than free-form message.

### Payments

Canonical Midtrans events:

- `MIDTRANS_WEBHOOK_APPLIED`
- `MIDTRANS_WEBHOOK_INVALID_BODY`
- `MIDTRANS_WEBHOOK_INVALID_SIGNATURE`
- `MIDTRANS_WEBHOOK_CONFIGURATION_ERROR`
- `MIDTRANS_WEBHOOK_ORDER_LOOKUP_FAILED`
- `MIDTRANS_WEBHOOK_ORDER_NOT_FOUND`
- `MIDTRANS_WEBHOOK_AMOUNT_MISMATCH`
- `MIDTRANS_STATUS_VERIFICATION_SKIPPED`
- `MIDTRANS_STATUS_VERIFICATION_UNAVAILABLE`
- `MIDTRANS_WEBHOOK_UPDATE_FAILED`

`MIDTRANS_WEBHOOK_APPLIED` is the payment-processing success event. Its fields include the normalized status, provider status, duplicate flag, verification source, dependency durations, and total request duration.

## Initial service objectives

These are launch thresholds, not long-term capacity guarantees.

| Signal | Target |
|---|---:|
| Health endpoint availability | >= 99.9% |
| Readiness endpoint availability | >= 99.5% |
| API server-error ratio | < 1% over 15 minutes |
| Payment webhook application success | >= 99% over 15 minutes |
| Webhook p95 duration | < 2,500 ms |
| Database dependency p95 duration | < 1,500 ms |
| Invalid-signature events | 0 expected; investigate every occurrence |
| Amount-mismatch events | 0 expected; treat every occurrence as critical |

## Dashboard panels

1. Request volume and HTTP status distribution.
2. API 5xx ratio by route and deployment SHA.
3. Order-creation success and failure counts.
4. Snap-token success and failure counts.
5. `MIDTRANS_WEBHOOK_APPLIED` count by normalized status.
6. Webhook failure count by canonical event.
7. Webhook total, Midtrans verification, lookup, and database-update latency percentiles.
8. Duplicate webhook ratio.
9. `/api/health` and `/api/ready` status over time.
10. Current production deployment SHA and payment mode.

## Correlation workflow

Start with the alert timestamp and deployment SHA. Filter by canonical event and then correlate records using `requestId`, `orderNumber`, and provider transaction ID. Do not copy customer data or credentials into incident notes.

## Retention

Retain operational logs for at least 30 days during preorder and launch. Retain payment audit records in the database according to the financial-record policy. Access must be restricted to operators who need it.
