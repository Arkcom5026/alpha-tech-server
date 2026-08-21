# Delivery Note Lifecycle — Wave 2I Production Authority Hardening

## Purpose

Close the production-facing authority gaps discovered after Wave 2H integration certification without changing stock, Sale totals, receivable, settlement, refund, or tax ownership.

## Changes

1. **One-time Sale Return provenance**
   - Revision creation no longer infers new return evidence from `returnedAt > predecessor.issuedAt`.
   - It reads `DeliveryNoteDocumentReturnSource` across the Sale lineage and excludes already-consumed `saleReturnId` values.
   - Only unconsumed `COMPLETED` Sale Returns may support the next revision.

2. **Stable concurrent-write conflict**
   - Prisma serialization conflict `P2034` and unique conflict `P2002` are normalized to `DELIVERY_NOTE_REVISION_WRITE_CONFLICT` with HTTP 409 authority.
   - No automatic retry is introduced because revision creation is not treated as blindly idempotent.

3. **Historical evidence after Sale cancellation**
   - Active/current Delivery Note printing remains blocked for cancelled Sales.
   - `historicalRead: true` may still project immutable historical Delivery Note evidence.

4. **Historical revision lookup ordering**
   - Exact persisted revision lookup happens before the legacy/presentation projection.
   - An invalid historical revision therefore fails before presentation snapshot work is reached.

## Numbering authority review

The existing original Delivery Note issuer currently derives the immutable original number as `DN-${sale.code}` and does not use a separate Delivery Note sequence allocator. Revision numbering remains rooted in that existing authority as `${originalDocumentNumber}-R${revisionNumber}`. This is a Delivery Note lifecycle identifier, not tax-document numbering authority.

## Explicit non-scope

- no schema or migration change
- no stock mutation
- no Sale total mutation
- no customer-money/payment/settlement mutation
- no refund behavior change
- no tax-document numbering or tax lifecycle change
- no client UX change
- no automatic retry of revision creation

## Deferred after Wave 2I

- immutable issuer/recipient presentation snapshot per Delivery Note revision
- settled-before-return surplus customer-money policy
- client Document History UX
- final consolidation/tax handoff E2E closure
