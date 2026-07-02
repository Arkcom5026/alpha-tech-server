# Catalog Audit Cleanup Scripts

## วางโครงสร้าง

```text
server/scripts/catalog-audit/
  cleanup-product-duplicates.js
  verify-product-catalog.js
  mappings/product-duplicate-mapping.json
```

## Dry Run

```bash
node scripts/catalog-audit/cleanup-product-duplicates.js --dry-run --branchCode=T01 --mapping=scripts/catalog-audit/mappings/product-duplicate-mapping.json
```

## Execute

```bash
node scripts/catalog-audit/cleanup-product-duplicates.js --execute --branchCode=T01 --mapping=scripts/catalog-audit/mappings/product-duplicate-mapping.json
```

## Verify

```bash
node scripts/catalog-audit/verify-product-catalog.js --branchCode=T01
```

## Safety

- Dry-run คือค่า default
- Execute ต้องระบุ `--execute`
- Script จะ update FK ก่อน delete Product
- สร้าง report ใน `server/scripts/reports/`
