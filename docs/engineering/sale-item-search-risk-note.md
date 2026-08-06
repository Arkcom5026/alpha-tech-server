# Risk Boundary

This change does not bypass reservation enforcement.

When `StockBalance` exists, its `quantity` and `reserved` values remain authoritative. Physical inventory is used only when the balance row is absent, preventing the previous false zero caused by an inner lookup that omitted the requested product entirely.
