# P1 Backend Docs

## Runtime Maps

- [Backend System Map](./backend/SYSTEM_MAP.md)
- [Backend Runtime Map](./backend/RUNTIME_MAP.md)
- [Stock / Procurement / Sales Domain Map](./backend/DOMAIN_MAP_STOCK_PROCUREMENT_SALES.md)
- [Backend Migration Map](./backend/MIGRATION_MAP.md)
- [Backend Mission Map](./backend/MISSION_MAP.md)

## Role Boot

- [P1 Role Boot Index](./roles/README.md)
- [ROLE-ARCH](./roles/ROLE-ARCH.md)
- [Frontend Roles](./roles/frontend/)
- [Backend Roles](./roles/backend/)

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
5. backend/MISSION_MAP.md
6. roles/README.md
7. assigned Role file
```

Use `MISSION_MAP.md` as the workflow lens, `RUNTIME_MAP.md` for Mission B runtime details, `DOMAIN_MAP_STOCK_PROCUREMENT_SALES.md` when a change touches Stock / PO Receipt / Sales runtime, `MIGRATION_MAP.md` before any backend refactor, extraction, or legacy cleanup, and `roles/` to keep each Task inside its responsibility boundary.
