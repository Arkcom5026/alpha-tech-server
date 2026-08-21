# Delivery Note Lifecycle — Wave 2G Migration & Transactional Readiness

## Status
IN PROGRESS — local verification required.

## Goal
Prove that the Wave 2 persistence migration is structurally ready and that the first-class Delivery Note revision tables support the required revision-chain write pattern inside a rollback-only disposable database transaction.

## What this wave verifies
- Wave 2 migration creates `DeliveryNoteDocument`, `DeliveryNoteDocumentLine`, and `DeliveryNoteDocumentReturnSource`.
- `currentKey` and revision-chain constraints are present.
- revision writes remain SERIALIZABLE in application service authority.
- revision numbering remains server-owned.
- a disposable database can persist revision 1 -> SUPERSEDED -> revision 2 CURRENT with line + Sale Return provenance.
- the entire verification transaction is intentionally rolled back and leaves zero Wave 2G rows.

## Safety gate
The database verifier refuses to run unless both are supplied:
- `DELIVERY_NOTE_LIFECYCLE_TEST_DATABASE_URL`
- `DELIVERY_NOTE_LIFECYCLE_ALLOW_DB_TEST=YES_I_AM_USING_A_DISPOSABLE_DATABASE`

It also refuses when the explicit test URL exactly matches the process `DATABASE_URL`.

Do not point this verifier at production, staging, or any database containing operational ALPHA-TECH data. It is intended for a disposable local/test PostgreSQL database only.

## Verification order
1. Run the static Wave 2G contract.
2. Run Prisma validate/generate.
3. Prepare a disposable PostgreSQL database.
4. Apply migrations to that disposable database only.
5. Run `scripts/verify-delivery-note-lifecycle-wave2g-db.js` with the explicit safety environment variables.
6. Confirm PASS and zero residual rows.

## Boundary
This wave does not deploy the migration to production and does not exercise a real Sale/Return fixture. It proves persistence/migration/transaction mechanics only. Real Sale 1046 verification remains a later controlled integration/production-readiness step after migration and runtime chain are integrated.
