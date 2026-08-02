const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');

assert.match(sql, /IF EXISTS \(SELECT 1 FROM "TaxExpense"\) OR EXISTS \(SELECT 1 FROM "TaxExpenseItem"\)/);
assert.match(sql, /ALTER TABLE "TaxExpenseItem" ADD COLUMN "branchId" INTEGER NOT NULL/);
for (const name of [
  'Supplier_id_branchId_key',
  'TaxExpenseCategory_id_branchId_key',
  'TaxExpense_id_branchId_key',
  'TaxExpense_supplierId_branchId_fkey',
  'TaxExpenseItem_taxExpenseId_branchId_fkey',
  'TaxExpenseItem_categoryId_branchId_fkey',
]) assert.ok(sql.includes(`"${name}"`));
assert.match(sql, /FOREIGN KEY \("supplierId", "branchId"\) REFERENCES "Supplier"\("id", "branchId"\)/);
assert.match(sql, /FOREIGN KEY \("taxExpenseId", "branchId"\) REFERENCES "TaxExpense"\("id", "branchId"\)/);
assert.match(sql, /FOREIGN KEY \("categoryId", "branchId"\) REFERENCES "TaxExpenseCategory"\("id", "branchId"\)/);
assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|INSERT\s+INTO|ALTER\s+TABLE[\s\S]*?\bDROP\b|ALTER\s+COLUMN|RENAME)\b/im);
assert.doesNotMatch(sql, /\b(PurchaseOrder|PurchaseOrderReceipt|PurchaseOrderItem)\b/);
console.log('Tax Expense tenant isolation migration contract: PASS');
