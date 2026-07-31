# Address List Vertical Slice Migration

Status: WORKING AREA

## Scope

Move only these lookup endpoints out of `controllers/addressController.js`:

```text
GET /api/address/provinces
GET /api/address/districts?provinceCode=...
GET /api/address/subdistricts?districtCode=...
```

## Migration Classification

- Stage: HYBRID → MODULE-FIRST for address lookup lists
- Production entrypoint: `src/modules/location/routes/addressRoutes.js`
- Legacy source: `controllers/addressController.js`
- Module target: `src/modules/location/address/list/`
- Refactor allowed: YES, only for the three lookup endpoints
- Deletion allowed: NO

## Locked Contracts

- endpoint URLs unchanged
- query names unchanged
- response shapes unchanged
- Thai-name ascending order unchanged
- Prisma schema unchanged
- remaining address utilities stay in the legacy controller

## Target Ownership

```text
Route
→ addressListController
→ addressListService
→ addressListRepository
→ Prisma
```

## Verification Status

Repository implementation: IN PROGRESS
Runtime verification: PENDING
Operational verification: PENDING
