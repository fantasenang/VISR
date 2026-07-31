# VISR Production Incident Runbook

## Severity

- **SEV-1:** Checkout or payment processing is unavailable, payment integrity is uncertain, or orders may be corrupted.
- **SEV-2:** Material degradation with a working fallback; multiple customers are affected.
- **SEV-3:** Limited defect with low customer impact.

## First 10 minutes

1. Record start time, reporter, severity, and current production deployment SHA.
2. Stop new deployments and avoid direct database edits.
3. Check `/api/health`, `/api/ready`, the latest production smoke result, and provider status pages.
4. Filter structured logs by canonical event and request ID.
5. Determine whether the incident started immediately after a deployment.
6. For SEV-1 payment incidents, pause promotional traffic while keeping evidence intact.

## Payment incident rules

- Never mark an order paid solely from a customer screenshot.
- Never disable Midtrans signature or amount verification.
- Verify the transaction against Midtrans and the stored order total.
- Preserve the notification payload and audit trail.
- Use the idempotent payment RPC for recovery; do not bypass payment-state rules.
- Produce a list of affected order numbers before remediation.

## Rollback decision

Rollback when the incident correlates with the latest release and rollback is safer than an in-place fix. After rollback, run:

```bash
npm run check:go-live
VISR_BASE_URL=https://visr.works npm run smoke:production
```

Rollback is not complete until readiness and smoke checks pass.

## Dependency failures

### Supabase

Confirm readiness failure and Supabase service status. Do not retry writes in an uncontrolled loop. Once restored, reconcile orders created around the outage window and verify webhook application.

### Midtrans

Keep orders pending. Do not infer successful payment from redirect state. After recovery, verify pending transactions through the provider and allow signed notifications or controlled reconciliation to apply state.

### RajaOngkir

Prevent checkout from silently accepting an unverified shipping charge. Preserve carts and communicate that shipping calculation is temporarily unavailable.

## Recovery validation

- Health and readiness return 200.
- Production smoke passes.
- New order creation succeeds.
- Snap-token creation succeeds in the configured environment.
- A controlled Midtrans test notification is accepted.
- No unexplained amount mismatch, invalid signature, or payment update failures remain.

## Closure

Document timeline, impact, root cause, affected orders, remediation, and preventive action. Rotate any credential that may have been exposed. Convert every material gap into a tracked engineering task.
