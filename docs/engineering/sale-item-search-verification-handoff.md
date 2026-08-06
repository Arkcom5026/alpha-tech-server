# Verification Handoff

Status: READY FOR VERIFICATION

Candidate branch: `fix/sale-item-search-availability-authority`

Required checks:

1. Run the missing-StockBalance recovery contract.
2. Run the existing reserved-stock enforcement contract.
3. Confirm the Prisma raw query compiles against the current schema.
4. Runtime-search a known sellable item in the authenticated store.
5. Verify the same query cannot return inventory from another store.

No source changes are authorized during Verification. Any failure returns the candidate to Engineering.
