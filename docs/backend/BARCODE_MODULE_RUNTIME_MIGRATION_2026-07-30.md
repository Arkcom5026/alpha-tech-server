# Barcode Module Runtime Migration

This increment moves the active Barcode runtime from the root `controllers/` structure into `src/modules/inventory/barcode/` without changing endpoints, identity generation, receipt audit, print/reprint, serial scanning, or receipt completion contracts.

## Runtime ownership

```text
/api/barcodes
→ src/modules/inventory/barcode/routes/barcodeRoutes.js
→ src/modules/inventory/barcode/barcodeController.js
→ src/modules/inventory/barcode/runtime/barcodeRuntime.js
```

## Preserved authority

- branch-scoped receipt access
- atomic barcode generation
- branch/month counter reservation
- `STRUCTURED` product to SN planning
- `SIMPLE` product to LOT planning
- barcode format `<branch><YYMM><running>`
- monthly running limit 9999
- barcode printing and reprinting
- receipt barcode audit
- serial-number update flows
- receipt completion flows

## Migration method

The runtime path points to the exact original Git blob SHA:

```text
f68024ad833d2156bf3e3725e3426b1aa697549e
```

This preserves the full runtime byte-for-byte while retiring the root path.

## Explicit exclusions

- no endpoint change
- no response contract change
- no barcode-format rewrite
- no counter logic rewrite
- no Prisma schema or migration change
- no Runtime PASS or Operational PASS claim
