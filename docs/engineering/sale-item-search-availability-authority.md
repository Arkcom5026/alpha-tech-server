# Sale Item Search Availability Authority Fix

## Scope

Fix POS sale-item search returning an empty result when sellable physical inventory exists but the product has no `StockBalance` row.

## Architecture Goal

Keep `StockBalance.reserved` as the reservation authority when a balance row exists, while preventing a missing balance row from being interpreted as zero physical inventory.

## Behavior

- Requested product IDs remain present in the availability result.
- Existing `StockBalance.quantity` and `StockBalance.reserved` remain authoritative when present.
- When the balance row is missing, physical quantity is derived branch-locally from:
  - `StockItem` rows in `IN_STOCK` status.
  - `SimpleLot.qtyRemaining` for `ACTIVE` lots.
- Tenant isolation remains enforced by authenticated `branchId` in every inventory source.
- Available quantity never becomes negative.

## Runtime Impact

Backend-only. The `/api/sales/items/search` response contract is unchanged.

## Verification Candidate

Run at minimum:

```text
node tests/sale-item-search-missing-stock-balance.contract.test.js
node tests/pos-reserved-stock-search-enforcement.contract.test.js
```

Runtime verification must search a known sellable item whose product previously had no `StockBalance` row and confirm that the result belongs only to the authenticated store.
