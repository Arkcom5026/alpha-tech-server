const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');

assert.ok(sql.includes('CREATE TYPE "SupplierCapability" AS ENUM (\'PROCUREMENT\', \'EXPENSE_PAYEE\')'));
assert.ok(sql.includes('CREATE TABLE "SupplierCapabilityAssignment"'));
assert.ok(sql.includes('"SupplierCapabilityAssignment_supplierId_capability_key"'));
assert.ok(sql.includes('"SupplierCapabilityAssignment_capability_supplierId_idx"'));
assert.match(sql, /FOREIGN KEY\s*\("supplierId"\)\s*REFERENCES\s*"Supplier"\("id"\)\s*ON DELETE RESTRICT/);
assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|INSERT\s+INTO|ALTER\s+TABLE[\s\S]*?\bDROP\b|ALTER\s+COLUMN|RENAME)\b/im);
assert.doesNotMatch(sql, /\b(PurchaseOrder|PurchaseOrderReceipt|PurchaseOrderItem)\b/);

console.log('Supplier capability migration contract: PASS');
