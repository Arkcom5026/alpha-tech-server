# Product Template Store Discovery Audit — Slice 3

## Goal

Read the real Store Product population and compare it with Product records owned by SYSTEM TEMPLATE Branches before any Candidate mutation occurs.

## Domain authority

- `Branch` is the Catalog ownership boundary.
- A SYSTEM TEMPLATE Branch owns platform Template Products.
- A normal Branch owns operational Store Products.
- `Product` is the single model on both sides.
- `ProductTemplateCandidate` is review persistence, not the discovery source.

## Scope

Expose an authenticated SUPERADMIN read-only endpoint:

`GET /api/product-templates/candidates/discovery-audit?businessType=IT`

The endpoint:

1. Finds normal Store Branches in the selected Business Type.
2. Resolves SYSTEM TEMPLATE Branches from the same Branch category scope.
3. Reads active Store Products and Template Products.
4. Classifies each Store Product as:
   - `LINKED_TEMPLATE`
   - `MATCHED_UNLINKED`
   - `CANDIDATE_OPEN`
   - `UNMATCHED`
5. Returns counts and catalog-safe Product evidence.

## Initial deterministic matching

An exact catalog fingerprint uses:

- normalized Product name
- Brand normalized name
- Global Product Type ID

This is deliberately conservative. It does not perform fuzzy matching and does not mutate `templateProductId`.

## Safety

- Read-only.
- No Candidate creation.
- No Product linking.
- No Template creation.
- No migrations.
- No Stock, Serial, Price, Cost, Supplier or transaction projection.
- No raw SQL.

## Deferred

- Fuzzy/confidence matching.
- Candidate grouping across stores.
- Automatic Candidate creation.
- Store Product create/update hook.
- Superadmin discovery UI.
- Template lifecycle management.

## Verification

`node tests/product-template-store-discovery-audit-slice-3.contract.test.js`
