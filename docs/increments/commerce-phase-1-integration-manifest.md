# Commerce Phase 1 Integration Manifest

## Mission

Integrate the complete accepted Commerce Phase 1 working agenda on top of the latest `main` without directly merging or rebasing materially diverged Working Area branches.

Canonical product flow:

```text
Public Discovery
→ Anonymous Shopping Session
→ Identity at Commitment
→ Server Revalidation
→ ProductReservation
```

## Authority

- Issue #69 — Commerce Product Blueprint
- PR #72 — Public Discovery working area
- PR #74 — Partner Store Capability working area
- PR #76 — Anonymous Shopping Session working area
- PR #80 — Identity at Commitment working area
- PR #81 — ProductReservation Commitment working area
- PR #48 — accepted architectural/source evidence

## Integration Decision

All five implementation branches are materially diverged from current `main`.

Direct merge, broad rebase, force update, or wholesale branch-history import is not accepted.

The integration strategy is **Selective Reconstruction on Latest Main**:

1. Preserve current `main` as the source of truth.
2. Reconstruct reviewed files and contracts selectively.
3. Resolve shared surfaces once in the integration branch.
4. Preserve newer unrelated `main` changes.
5. Keep all Working Area PRs open as evidence until final integration is accepted.
6. Do not merge this integration PR until the complete assigned agenda is finished.

## Reconstruction Order

Dependency order:

1. Partner Store Capability foundation — PR #74
2. Public Storefront Product Discovery — PR #72
3. Anonymous Shopping Session — PR #76
4. Identity at Commitment — PR #80
5. ProductReservation Commitment — PR #81
6. Unified Prisma/schema alignment
7. Unified route/CORS/package wiring
8. Cross-increment repository review
9. Final agenda merge decision

## Shared Conflict Surfaces

### `server.js`

Must mount, before authenticated Sales routes:

- public storefront projection
- anonymous shopping session
- commerce identity
- reservation commitment

CORS must allow the union of:

- `X-Anonymous-Session-Token`
- `X-Commerce-Identity-Proof`
- `X-Idempotency-Key`

No newer unrelated route or middleware from `main` may be removed.

### `package.json`

Must preserve current-main dependencies/scripts and add only required Commerce verification/alignment scripts.

No dependency may be removed as part of reconstruction.

### Public Storefront Route Ownership

PR #74 and PR #72 both project `GET /api/sales/storefronts/:slug`.

Integration must produce one public storefront endpoint combining:

- store policy/capability projection
- customer-safe product discovery projection

It must not mount two handlers that compete for the same method/path.

### Prisma and Migrations

Migration order must remain additive:

1. Partner Store Capability
2. Anonymous Shopping Session
3. Identity at Commitment
4. ProductReservation Commitment Alignment

Prisma schema must represent supported durable changes once, with PostgreSQL-only partial indexes retained as database authority.

## Invariants

- browsing remains anonymous
- identity is requested only at commitment
- raw session, OTP, and proof tokens are never persisted
- client never owns price, branch, stock, or totals
- commitment revalidation is transaction-owned
- proof consumption is single-use
- Internal Employee Reservation flow remains valid
- no Sale, Payment, or Delivery is created by commitment
- no Working Area is merged independently

## Verification Policy

Owner-directed rapid agenda policy:

- CI: skipped
- Test/Build before final merge: skipped
- Repository review: required
- Runtime/Operational verification: deferred to owner-led Production validation after final agenda merge
- Runtime/Operational PASS must not be claimed before that validation

## Current State

- Integration branch from latest `main`: CREATED
- Dependency/drift survey: COMPLETE
- Integration manifest: COMPLETE
- Selective reconstruction: PENDING
- Cross-increment review: PENDING
- Final merge: NOT AUTHORIZED
- Deploy/Production impact: NONE
