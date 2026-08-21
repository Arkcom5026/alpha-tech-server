# Delivery Note Lifecycle — Wave 1 Domain Foundation

Status: IN PROGRESS — pure domain foundation, no schema/runtime integration yet

## Purpose

Define Delivery Note lifecycle semantics before persistence changes. This wave intentionally introduces a pure resolver layer that can project current Delivery Note state from existing Sale + return evidence without changing database authority.

## Domain states

- `ACTIVE` — issued Delivery Note remains current and has no return/successor/consolidation consumption.
- `ADJUSTED` — Sale Return changed active remaining quantity/value, but no successor or consolidation has consumed the document.
- `SUPERSEDED` — a successor Delivery Note revision owns current document authority.
- `CONSOLIDATED` — active remaining lines have been consumed by a consolidated delivery document.
- `CANCELLED` — source Sale/document is cancelled under explicit cancellation authority.

Historical readability is independent from current downstream eligibility.

## Line projection authority

Wave 1 introduces a shared pure projection for Sale-backed Delivery Note lines.

For each source line it records:

- original quantity
- returned quantity
- active remaining quantity
- original line amount
- returned amount
- active remaining line amount

Returned quantities can never re-enter the active line set.

### Production reference

`SL-022608-0077`

- historical Sale gross: `1,810.00`
- returned APACER value: `640.00`
- active remaining Delivery Note value: `1,170.00`
- lifecycle state before replacement/consolidation: `ADJUSTED`

The original `Sale.totalAmount` remains historical gross authority.

## Action authority

The domain resolver derives actions separately from lifecycle state.

`ACTIVE`
- historical readable
- current print allowed
- consolidation allowed when active value remains and tax is not issued
- tax handoff allowed when active value remains and tax is not issued

`ADJUSTED`
- historical readable
- current print allowed during compatibility period
- adjusted-revision creation allowed when active value remains and tax is not issued
- consolidation allowed when active value remains and tax is not issued
- tax handoff allowed when active value remains and tax is not issued

`SUPERSEDED` / `CONSOLIDATED` / `CANCELLED`
- historical readable
- current source actions disabled

If tax authority has already been issued and the document later has a return, Delivery Note revision/consolidation/tax re-handoff are blocked and statutory correction authority is required.

## Consumption invariant

A single Delivery Note cannot simultaneously have both:

- active successor authority, and
- active consolidated consumption authority.

The pure resolver raises `DELIVERY_NOTE_LIFECYCLE_CONSUMPTION_CONFLICT` for that impossible state. Persistence waves must enforce the same invariant transactionally.

## Compatibility boundary

This wave does **not**:

- add Delivery Note tables
- change `Sale.officialDocumentNumber`
- change existing print routes
- change Settlement or Combined Billing behavior
- alter TaxDocument authority
- create stock movement
- mutate receivable totals

It only creates reusable domain semantics and contracts.

## Next integration target

Before persistence, the next safe step is to introduce a compatibility adapter/service that loads existing facts from:

- Sale + SaleItem/SaleItemSimple
- Sale Return returned quantities
- ConsolidatedDeliveryLine active consumption
- issued TaxDocument evidence

and returns the pure lifecycle projection without changing current endpoints. Once this adapter is contract-proven, print/history/consolidation callers can migrate to it incrementally.
