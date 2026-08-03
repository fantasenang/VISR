# VISR Project State

Canonical handoff for continuing VISR development across ChatGPT conversations.

Last updated: 2026-08-03 (Asia/Jakarta)

## How to continue in a new chat

Start a new conversation inside the same VISR Project and send:

> Continue VISR from `VISR_PROJECT_STATE.md`. Read the current `main` branch and latest Vercel production deployment before making changes. Continue the Immediate Pending Work section without repeating finished work.

Do not rely only on chat memory. This file, the current `main` branch, Vercel runtime logs, and production state are the source of truth.

## Project

- Repository: `fantasenang/VISR`
- Production branch: `main`
- Production domain: `visr.works`
- Vercel project: `visr-digital-exhibition`
- Vercel project ID: `prj_drkQWz5kP1C3HkgMikfyBBRYVrGb`
- Vercel team ID: `team_tGUNel9cLgGbw2gHzSzuaqZp`
- Timezone: `Asia/Jakarta`
- Midtrans environment: sandbox unless explicitly verified otherwise
- Never expose passwords, tokens, service-role keys, or payment-provider secrets

## Current Production State

- Current production HEAD at time of this handoff: `7b05e64a50db9d19ba3e48ddf6bc6eb0f8d27572`
- Latest verified production deployment: `dpl_23WjWGnP9yJzTtbQSTjRJXUZ6edd`
- Deployment state: `READY`
- Production aliases include `visr.works` and `www.visr.works`

## Commerce Behavior Already Implemented

- Automatic domestic shipping subsidy up to Rp20.000
- Customer pays `max(original shipping - 20.000, 0)`
- Original and discounted shipping are displayed in checkout
- Free-shipping orders with shipping cost Rp0 are accepted by checkout and server validation
- Paid-order receipt PDF endpoint exists
- Track Order verifies access using order number plus email or WhatsApp
- Receipt is available only for server-verified paid orders
- Admin order cancellation and reservation expiry are intended to release stock
- Production stock counters can be reconciled from reservation rows

## Latest Payment and Stock Incident

Trial order involved:

- Order: `VISR.B02.20260803.005`
- Amount: Rp198.000
- Midtrans sandbox sent signed `settlement` notifications
- The original database RPC failed with PostgreSQL error `42702: column reference "order_id" is ambiguous`
- A server-side payment-state fallback was added
- One-time recovery returned success and changed the order from `pending` to `paid`

Stock history:

- Three trial reservations reduced VISR Carry availability from 100 to 97
- Two canceled/unused reservations were reconciled and released
- Public stock was verified at 99 remaining before the paid-order recovery, with 1 reserved and 0 sold
- After recovery, the expected correct state is 99 remaining, 0 reserved, 1 sold; this still requires a final production verification

## Post-Payment UX Goal

After Midtrans finishes:

1. Customer should not land on a blank Track My VISR form.
2. The browser should use checkout session data to open the matching order automatically.
3. Paid status should be refreshed from the server.
4. The order/invoice view should appear directly.
5. A prominent `Download Receipt PDF` action should be available immediately when payment is verified.
6. Manual Track My VISR remains available when the customer returns later or uses another device.

Relevant implementation added on `main`:

- Checkout order-access bridge using browser session storage
- Automatic order lookup after payment return
- Direct post-payment order and receipt view
- Payment-state fallback when the legacy RPC fails
- Exact inventory counter reconciliation
- Corrected SQL migration for `apply_midtrans_notification`

## Immediate Pending Work

Continue these in order:

1. Delete the temporary one-time recovery route:
   `src/app/api/internal/recover-sandbox-order-005-7f4c9e/route.ts`
2. Deploy the deletion to production and confirm that route returns 404.
3. Verify `/api/stock` shows VISR Carry:
   - total: 100
   - reserved: 0
   - sold: 1
   - remaining: 99
4. Verify order `VISR.B02.20260803.005` appears as paid/verified in VISR Control.
5. Verify its receipt PDF can be downloaded.
6. Test the same-browser Midtrans return flow and confirm it opens the order directly without asking for email or WhatsApp again.
7. Run one clean sandbox end-to-end order after cleanup:
   reservation -> Snap -> paid notification -> paid order -> downloadable receipt -> correct stock transition.
8. Inspect Vercel logs for any remaining `MIDTRANS_WEBHOOK_UPDATE_FAILED` or stock reconciliation errors.

## Working Rules

- Diagnose using actual runtime logs before patching.
- Test changes on a branch/preview when practical, then move to `main` after build success.
- Announce production completion only after Vercel reports `READY` and aliases are active.
- Do not claim payment, stock, or receipt behavior is fixed until production data verifies it.
- Update this file after meaningful production changes so a new chat can continue accurately.
