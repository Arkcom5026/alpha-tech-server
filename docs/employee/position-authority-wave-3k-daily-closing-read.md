# Wave 3K — Daily Closing Read Position Authority

## Scope

This wave migrates the mounted daily-closing summary read boundary to Position-first authorization.

Route in scope:

- `GET /api/finance/daily-closing-summary`

The route remains authenticated by the existing finance router / daily-closing authentication chain. This wave adds feature authority only.

## Capability

- `finance.daily-closing.read`

## Compatibility contract

Before this wave, the daily-closing summary route was authenticated-only. During migration, legacy `v2Role` compatibility therefore preserves read access for OWNER, MANAGER, CASHIER, and TECHNICIAN.

For migrated positions, any non-null capability array is authoritative, including `[]`. The route requires the explicit `finance.daily-closing.read` capability. ADMIN and SUPERADMIN retain platform authority through the central resolver.

## Ownership boundaries

- Route middleware owns feature authorization.
- `dailyClosingRuntimeController` continues to derive `branchId` only from the authenticated user and keeps branch isolation.
- Existing service/repository aggregation semantics are unchanged.
- No write, close, settlement, payment, or tax authority is introduced by this read capability.

## Persistence

No Prisma schema or migration change is required.
