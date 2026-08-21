# Position Authority Wave 2G — Quick Receipt Session

## Goal

Move Quick Receipt Session authority from broad authenticated employee access to Position-first capability authority without changing the existing business, price, tax, inventory, idempotency, or actor-continuity contracts.

## Capability boundary

Wave 2G introduces two capabilities:

- `inventory.quick-receipt`
  - list Quick Receipt sessions
  - view session detail
  - create a draft session
  - update draft header/data
  - add draft items
  - delete draft items
- `inventory.quick-receipt.finalize`
  - complete one-shot Quick Receipt
  - finalize an existing session
  - cancel an existing session

Finalization authority is intentionally not sufficient by itself. Routes that close a session require both `inventory.quick-receipt` and `inventory.quick-receipt.finalize`.

## Why two capabilities

Draft preparation and session closure are materially different responsibilities. A staff member may be allowed to prepare receiving data without being authorized to post inventory consequences, publish downstream tax intake, or cancel an operational receiving session.

The split also prevents the access/edit capability from silently granting finalization authority.

## Compatibility policy

Before this migration, Quick Receipt routes were protected by authenticated employee context rather than a business-role capability boundary. To avoid silent privilege loss during migration:

- legacy Position state (`Position.capabilities = null`) preserves Quick Receipt access and finalization for OWNER, MANAGER, CASHIER, and TECHNICIAN compatibility roles;
- migrated Position state (`Position.capabilities` is any array, including `[]`) is authoritative;
- ADMIN and SUPERADMIN keep platform authority;
- no Position display name is interpreted as authority.

## Existing authority preserved

Wave 2G does not replace or weaken:

- Quick Receipt actor continuity;
- branch ownership and session ownership checks;
- price/cost authority;
- inventory finalization rules;
- tax candidate publication;
- idempotency protection;
- Quick Stock one-shot authority (`inventory.quick-stock`).

## Route mapping

Draft/read routes require `inventory.quick-receipt`:

- `GET /api/quick-stock/receipts`
- `POST /api/quick-stock/receipts`
- `GET /api/quick-stock/receipts/:id`
- `PATCH /api/quick-stock/receipts/:id`
- `POST /api/quick-stock/receipts/:id/items`
- `DELETE /api/quick-stock/receipts/:id/items/:itemId`

Closure routes require both capabilities:

- `POST /api/quick-stock/receipts/complete`
- `POST /api/quick-stock/receipts/:id/finalize`
- `POST /api/quick-stock/receipts/:id/cancel`

## Out of scope

- Procurement Purchase Receipt authority
- supplier approval or supplier payment authority
- product maintenance authority
- pricing policy redesign
- tax authority redesign
- removing `v2Role`
- Prisma schema changes or migrations

## Verification target

Focused verification should include:

- Quick Receipt position authorization contract
- Quick Stock route contract
- Quick Receipt controller/service contracts
- employee lifecycle verification
- full server certification
- Client Position authority contract
- Client typecheck/build
