const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const schema = fs.readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8')
const migration = fs.readFileSync(
  path.join(
    root,
    'prisma',
    'migrations',
    '20260727102000_add_product_inventory_authority',
    'migration.sql'
  ),
  'utf8'
)

assert.match(
  schema,
  /inventoryBehavior\s+ProductInventoryBehavior\s+@default\(TRACKED\)/
)
assert.match(schema, /saleBarcode\s+String\?/)
assert.match(
  schema,
  /enum ProductInventoryBehavior\s*{\s*TRACKED\s+NON_STOCK\s*}/
)
assert.match(schema, /@@index\(\[mode, inventoryBehavior, active\]\)/)
assert.match(schema, /@@index\(\[saleBarcode\]\)/)

assert.match(
  migration,
  /CREATE TYPE "ProductInventoryBehavior" AS ENUM \('TRACKED', 'NON_STOCK'\)/
)
assert.match(
  migration,
  /ADD COLUMN "inventoryBehavior" "ProductInventoryBehavior" NOT NULL DEFAULT 'TRACKED'/
)
assert.match(migration, /ADD COLUMN "saleBarcode" TEXT/)
assert.doesNotMatch(migration, /UNIQUE[^;]*saleBarcode|saleBarcode[^;]*UNIQUE/i)

console.log('Product Inventory Authority Contract: PASS')
