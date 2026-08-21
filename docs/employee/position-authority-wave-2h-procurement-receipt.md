# Position Authority Wave 2H — Procurement Receipt

## Scope

Wave 2H migrates the Purchase Order Receipt / Purchase Receipt workflow from authentication-only access to Position-first capability authority.

This wave is intentionally limited to `src/modules/procurement/receipt`. It does not change Purchase Order approval, supplier payment, pricing authority, Quick Stock, or Quick Receipt Session authority.

## Archaeology and compatibility

Before this wave, both Purchase Receipt route groups used `verifyToken` only. There was no business-role guard in the receipt routes. Therefore the migration must not silently remove access from legacy OWNER, MANAGER, CASHIER, or TECHNICIAN profiles while their Position has `capabilities = null`.

Compatibility semantics remain:

- `Position.capabilities = null` → use legacy `v2Role` compatibility.
- `Position.capabilities = []` or any non-null array → Position is authoritative.
- ADMIN / SUPERADMIN keep platform authority.
- Position display names are never interpreted as permissions.

## Capabilities

### `procurement.receipt`

Allows operational receipt preparation and read access, including:

- list and view Purchase Receipts;
- create normal or quick receipt records;
- view PO items and receipt items;
- add, edit, and remove receipt items;
- edit receipt notes;
- generate barcode identities;
- mark/print receipt barcode documents;
- view ready-to-pay and barcode summary projections.

This capability does not permit the actions that close, destroy, or commit the receipt to stock.

### `procurement.receipt.finalize`

This is an elevated capability. Routes protected by it require **both** `procurement.receipt` and `procurement.receipt.finalize`.

It covers:

- finalizing a Purchase Receipt;
- committing a Purchase Receipt into inventory;
- deleting the whole Purchase Receipt.

`commit` is privileged because it can create `SimpleLot` / `StockItem` records, increment stock balance, write inventory movement, and mark the receipt completed.

Deleting a whole receipt is also treated as an elevated destructive action; deleting an individual draft line remains part of receipt preparation.

## Boundaries preserved

Wave 2H does not replace or weaken existing branch ownership, product receive policy, barcode coverage, PO synchronization, pricing, payment, tax, or inventory persistence rules. Position capability is an additional business-authority boundary only.

## Verification targets

Focused local verification should include:

- `node src/modules/procurement/receipt/shared/purchaseReceiptAuthorization.test.js`
- `node src/modules/procurement/receipt/create/createPurchaseReceiptSlice.test.js`
- `node src/modules/procurement/receipt/commit/commitReceiptRepository.test.js`
- `node src/modules/procurement/receipt/finalize/finalizeReceiptRepository.test.js`
- `node src/modules/procurement/receipt/receiptModuleImports.test.js`
- `node scripts/verify-employee-lifecycle-runtime.js`
- full `npm run test`
- `npx prisma validate`

Client verification should cover the Position capability UI contract, onboarding compatibility contract, typecheck, and production build.
