# VISR BCA QRIS Operations

## Customer flow

1. Customer completes product, address, and shipping review.
2. The order is reserved with the existing inventory hold.
3. Checkout opens the signed BCA QRIS payment page.
4. The customer pays the exact amount shown: order total plus the order-matching code.
5. The customer taps **I Have Paid**.
6. The order and its active inventory reservations are held for at least another six hours while verification is pending.
7. The customer can track the order while payment remains pending.

## Owner verification

1. Open `/visr-control/qris` while signed in to VISR Control.
2. Match the exact expected amount against the BCA merchant transaction record.
3. Do not accept a customer screenshot as proof of settlement.
4. Select **Mark Payment Verified** and confirm the action.
5. Verification marks the order paid, confirms fulfillment, finalizes inventory reservations, and reconciles stock counters.

## QRIS asset

The customer payment page and download endpoint serve the verified BCA QRIS code for NMID `ID1026565261819`, terminal `A01`.

## Midtrans

The existing Midtrans implementation remains in source control. The customer payment action is temporarily routed to BCA QRIS through the checkout override and can be removed later when Midtrans production access is available.
