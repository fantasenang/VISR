# BCA QRIS Release Test Checklist

- [x] Production build and TypeScript compilation complete on the preview branch.
- [x] Signed QRIS route rejects requests without a valid order token.
- [x] QRIS image endpoint returns `image/png` and supports inline and attachment delivery.
- [x] Customer payment confirmation does not mark an order paid automatically.
- [x] Customer confirmation extends both the order deadline and active inventory-reservation expiry.
- [x] Verification queue requires an authenticated VISR Control session.
- [x] Owner verification requires confirmation and must be matched against the BCA merchant record.
- [x] Successful verification uses the existing payment-state transition and inventory reconciliation path.
- [x] Existing Midtrans implementation remains available in source control.

## Required production smoke test

After deployment, create one low-risk internal reservation and verify the full path without completing a real customer order:

1. Confirm checkout shows **Continue to QRIS BCA**.
2. Confirm QRIS opens and downloads correctly.
3. Confirm the exact amount includes the matching code.
4. Do not pay unless an actual test transaction is intentionally approved.
5. If a test payment is made, confirm it appears in BCA before marking it verified.
6. Confirm order tracking changes from pending to paid only after owner verification.
