# VISR Backup and Recovery Playbook

## Protected data

The recovery scope includes Supabase PostgreSQL data, schema migrations, payment notification audit records, order and order-item records, deployment environment configuration, and provider callback configuration. Repository source is protected by Git history but is not a substitute for database backups.

## Recovery objectives

- Target recovery point objective: 24 hours normally; reduce to 1 hour during preorder and launch where the Supabase plan supports it.
- Target recovery time objective: 4 hours for database restoration and commerce validation.
- Payment audit records and order state have the highest recovery priority.

## Backup controls

1. Confirm automated Supabase backups are enabled for the production project.
2. Before preorder launch and before destructive migrations, create a recoverable database backup or point-in-time restore marker.
3. Keep all schema changes in versioned migrations.
4. Export a restricted order and payment reconciliation snapshot during active launch windows.
5. Store recovery material outside the application runtime and restrict operator access.
6. Never place production credentials or customer exports in Git.

## Restore procedure

1. Declare an incident and freeze writes when continued traffic could worsen corruption.
2. Identify the last known-good recovery point and quantify expected data loss.
3. Restore into an isolated project or database first whenever possible.
4. Apply repository migrations only after confirming the restored schema version.
5. Validate row counts and referential integrity for orders, order items, and payment audit records.
6. Reconcile payment status against Midtrans for the affected time window.
7. Point the application to the recovered database only after validation.
8. Run diagnostics, go-live checks, readiness, and production smoke tests.
9. Re-enable traffic gradually and monitor canonical payment events.

## Required validation queries

Operators must verify:

- every order has a valid order number and total;
- every order item references an existing order;
- paid orders have an auditable provider transaction or notification record;
- no expired or cancelled order was promoted directly to paid outside the allowed state machine;
- duplicate provider notifications did not create duplicate fulfillment actions.

Exact SQL should be maintained alongside the current schema and tested on a non-production restore.

## Restore drill

Run a restore drill before Batch 2 preorder and at least quarterly afterward. Record backup timestamp, restore duration, migration result, validation result, smoke result, and unresolved gaps. A backup is not considered reliable until a restore drill succeeds.

## Credential recovery

If compromise is suspected, rotate the Supabase service-role key, Midtrans server key, shipping API key, and affected Vercel environment variables. Redeploy, validate callback configuration, and confirm old credentials no longer work.
