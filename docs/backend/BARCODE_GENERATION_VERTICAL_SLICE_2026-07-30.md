# Barcode Generation Vertical Slice

This increment extracts only barcode generation and counter authority from the legacy root controller.

## Ownership

```text
POST /api/barcodes/generate-missing/:receiptId
→ generate/generateBarcodeController.js
→ generate/generateBarcodeService.js
→ generate/generateBarcodeRepository.js
→ Prisma transaction
```

## Preserved behavior

- branch-scoped receipt lookup
- dry run response
- STRUCTURED products generate missing SN identities
- SIMPLE products generate one LOT identity when missing
- branch and YYMM counter key
- atomic counter reservation
- overflow rollback above 9999
- barcode format `<branch><YYMM><running four digits>`
- createMany with skipDuplicates
- existing HTTP status and response contracts

## Deliberately deferred

The following handlers remain temporarily owned by the root controller and must be migrated as separate vertical slices:

- receipt barcode queries
- print and reprint
- scan readiness and serial update
- receipt barcode audit
- receipt completion

## Explicit exclusions

- no root controller retirement in this slice
- no unrelated barcode handler migration
- no endpoint or response contract change
- no Prisma schema or migration change
- no Runtime PASS or Operational PASS claim
