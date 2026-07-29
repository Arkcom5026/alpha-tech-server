# Barcode Root Controller Retirement

## Authority

The Barcode module runtime is now owned by responsibility-specific vertical slices:

- `generate/`
- `query/`
- `print/`
- `scan/`
- `audit/`
- `completion/`

`src/modules/inventory/barcode/routes/barcodeRoutes.js` no longer imports the legacy root controller.

## Retired file

```text
controllers/barcodeController.js
```

The file was removed only after repository reference inspection confirmed that the current Barcode route graph uses the vertical-slice controllers. GitHub code search results from the default branch were treated as potentially stale and relevant files were re-read from the completion-slice head before deletion.

## Guard

```text
tests/barcode-root-controller-retirement.contract.test.js
```

The guard verifies:

- the legacy file remains absent;
- runtime source roots do not reference the retired controller path;
- all Barcode route responsibilities remain connected to their vertical-slice controllers.

## Explicit non-changes

- no endpoint change;
- no response-contract change;
- no business-rule change;
- no Prisma schema or migration change;
- no frontend change;
- no production deployment.

## Verification status

Repository cleanup is complete for this increment. Executable test, runtime and operational verification remain pending until run in an execution environment.
