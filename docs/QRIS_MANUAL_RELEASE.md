# BCA QRIS Release

This release temporarily routes the existing reservation checkout from Midtrans to BCA static QRIS while retaining the Midtrans implementation for later reactivation.

Production behavior:

- Signed order-specific payment page.
- Exact payment amount with a matching code.
- Official downloadable BCA QRIS asset.
- Customer payment claim without automatic paid status.
- Extended stock hold while owner verification is pending.
- Authenticated verification queue in VISR Control.
- Manual paid transition only after matching the BCA merchant record.
