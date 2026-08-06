# Sales Completion E2E Authority

This module owns Sales completion verification following the Repair E2E pattern.

## Authority split

- Browser E2E proves real user flow with the client.
- Server E2E verifies backend post-condition.
- No mocked sale completion is used as business evidence.

## Scope

- Sale completion
- Payment persistence
- Inventory movement
- Receipt readiness
- Branch isolation
