# Quick Stock Initial-load Performance — Wave 2

## Trigger

Wave 1 parallelized independent dropdown reads but the local runtime benchmark did not show a measurable improvement. After the nodemon restarts settled, five stable samples had medians around:

- suppliers: 913.310 ms
- draft receipts: 1224.199 ms
- quick-stock dropdowns: 1828.976 ms

The dropdown endpoint remains roughly one additional remote-DB round trip slower than the supplier endpoint.

## Working hypothesis

`listTemplateProductTypes()` still performs two sequential database reads on the critical path:

1. resolve template branch `T01`
2. query product types for that resolved branch id

`listUnits()` can run in parallel, but it cannot remove the serial branch-resolution + product-type chain.

## Wave 2 objective

Measure the internal stages before changing query shape. Add opt-in local diagnostics that report elapsed time for:

- template product types (whole repository call)
- units
- brands when a product type is selected
- total dropdown service latency

The diagnostics must be disabled by default and must not alter API response shape.

## Exit criteria

Use the trace to confirm which stage owns the extra latency. Only then choose between branch-id caching, a one-round-trip joined query, or another narrower optimization.
