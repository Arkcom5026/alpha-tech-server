# P1 Backend Docs

## Runtime Maps

- [Backend System Map](./backend/SYSTEM_MAP.md)
- [Backend Runtime Map](./backend/RUNTIME_MAP.md)
- [Stock / Procurement / Sales Domain Map](./backend/DOMAIN_MAP_STOCK_PROCUREMENT_SALES.md)
- [Backend Migration Map](./backend/MIGRATION_MAP.md)

## Current Mission Focus

Mission B is an end-to-end workflow mission:

```txt
Template Search
→ Operational Product clone/create
→ BranchPrice ready
→ Stock intake
→ Product usable in branch runtime
```

Read order for backend boot:

```txt
1. backend/SYSTEM_MAP.md
2. backend/RUNTIME_MAP.md
3. backend/DOMAIN_MAP_STOCK_PROCUREMENT_SALES.md
4. backend/MIGRATION_MAP.md
```

Use `RUNTIME_MAP.md` for Mission B details, `DOMAIN_MAP_STOCK_PROCUREMENT_SALES.md` when a change touches Stock / PO Receipt / Sales runtime, and `MIGRATION_MAP.md` before any backend refactor, extraction, or legacy cleanup.
