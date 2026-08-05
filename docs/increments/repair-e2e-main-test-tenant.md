# Repair E2E Main-DB Test-Tenant Foundation

## Mission

Modernize the existing Repair Intake Completion E2E package so it can run against the normal Main Database through the dedicated test tenant without manual database switching.

## Fixed Test Tenant

- Branch ID: `13`
- Slug: `test-shop`
- Purpose: Browser E2E and runtime smoke testing only

## Authority Contract

The existing dedicated Test DB path remains available. A new explicit `MAIN_TEST_TENANT` mode will:

- use the normal application database connection
- require an explicit Main-DB E2E write approval token
- require the authenticated operator to belong to branch `13`
- require the resolved branch slug to be `test-shop`
- create fixtures only through branch-owned Repair domain services
- never mutate operator credentials
- retain created records as identifiable E2E evidence
- use a read-only outcome verifier after the Browser run

## Non-Scope

- Prisma schema or migration changes
- destructive cleanup
- writes to real stores
- Repair workflow business-rule changes
- Warranty Claim lifecycle expansion

## Target Package

`src/modules/repair/e2e/intake-completion/`
