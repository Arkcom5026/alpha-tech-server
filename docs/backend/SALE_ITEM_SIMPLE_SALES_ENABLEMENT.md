# SaleItemSimple Sales Enablement

## Status

Architecture authority for branch `feature/sale-item-simple-sales-enablement`.

## Product decision

This scope enables sales of `SaleItemSimple` alongside the existing serialized `SaleItem` flow.

A service fee is not a separate service workflow and does not describe the performed operation. The sold product or related work provides that context.

A service fee is represented as a normal `Product` with:

- `mode = SIMPLE`
- reusable product-level barcode
- editable selling price
- inventory tracking disabled

Do not introduce service categories, service-operation types, repair links, warranty links, or a separate sale-service domain.

## Domain ownership

- Product owns product identity, mode, unit, barcode aliases, and branch price.
- Sales owns cart lines, totals, sale persistence, payment, and document projection.
- Stock owns quantity deduction and stock movements for inventory-tracked products.
- Repair and Warranty Claim remain independent.

## Sale line contract

The completion API accepts mixed `lines`.

### STOCK_ITEM

```json
{
  "lineId": "stock-421",
  "lineType": "STOCK_ITEM",
  "stockItemId": 421,
  "productId": 31,
  "quantity": 1,
  "basePrice": 2500,
  "discount": 0,
  "price": 2500,
  "vatAmount": 163.55
}
```

Persistence and stock effects:

- create `SaleItem`
- update `StockItem` from `IN_STOCK` to `SOLD`
- create `StockMovement` with `qty = -1`

### SIMPLE

```json
{
  "lineId": "simple-52-1",
  "lineType": "SIMPLE",
  "productId": 52,
  "simpleLotId": null,
  "quantity": 2,
  "unitPrice": 100,
  "basePrice": 200,
  "discount": 0,
  "price": 200,
  "vatAmount": 13.08
}
```

Persistence:

- create `SaleItemSimple`

Stock effects are determined by server-owned Product inventory policy, never by a client-provided flag.

- tracked SIMPLE: decrease `StockBalance.quantity`; create `StockMovement`
- tracked SIMPLE with lot: decrease the selected `SimpleLot` and synchronized balance; create `StockMovement`
- non-stock SIMPLE: no balance update and no stock movement

## Product inventory policy

`ProductMode` remains:

```text
SIMPLE
STRUCTURED
```

Add an explicit server-owned inventory behavior instead of adding `SERVICE` to `ProductMode`:

```text
TRACKED
NON_STOCK
```

Default must be `TRACKED` for backward compatibility.

Example service-fee product:

```text
name: ค่าบริการ
mode: SIMPLE
inventoryBehavior: NON_STOCK
branch price: 0.00 or configured default
price editable at sale time
```

## Barcode authority

Serialized merchandise continues to resolve through `StockItem.barcode`.

Reusable SIMPLE products require product-level barcode authority. The barcode must identify the Product, not a consumable StockItem.

Resolution order:

1. exact `StockItem.barcode`
2. active product-level barcode

Result:

- StockItem match -> `STOCK_ITEM` line
- Product match with `mode = SIMPLE` -> `SIMPLE` line

## Frontend cart identity

`stockItemId` cannot remain the universal row identity.

All cart actions must use `lineId`:

- add line
- remove line
- update quantity
- update unit price
- update discount
- bill-discount allocation

Serialized lines keep `quantity = 1`.

## Backward compatibility

During transition, the completion API may accept legacy `sale.items` and normalize them to `STOCK_ITEM` lines.

New clients send `sale.lines`.

The server remains the authority for:

- product mode
- inventory behavior
- branch ownership
- stock availability
- lot availability
- canonical totals

## Implementation order

1. Additive Prisma foundation: Product inventory behavior and product-level barcode.
2. Completion contract: mixed lines with legacy item normalization.
3. Completion runtime: split StockItem and SaleItemSimple persistence.
4. Stock runtime: tracked balance/lot deductions; non-stock bypass.
5. Frontend cart identity: `lineId`.
6. Product barcode lookup and SIMPLE line creation.
7. Mixed sale table: quantity and editable price for SIMPLE.
8. Documents/history: merge `items` and `simpleItems`.
9. Return/refund operational completion.
10. Local Runtime Gate and Operational Gate verification.

## Scope exclusions

- repair workflow
- warranty claim workflow
- service-operation categorization
- technician labor costing
- commission
- packages or bundles
- automatic product-to-service mapping
