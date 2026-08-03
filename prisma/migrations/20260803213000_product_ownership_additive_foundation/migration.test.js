'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..');
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
const sql = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');
const productModel = schema.match(/model Product \{([\s\S]*?)\n\}/)?.[1];

assert.match(schema, /model Branch \{[\s\S]*?\n\s+products\s+Product\[\]/);
assert.ok(productModel, 'Product model must exist');
assert.match(productModel, /\n\s+branchId\s+Int\?/);
assert.match(productModel, /branch\s+Branch\?\s+@relation\(fields: \[branchId\], references: \[id\]\)/);
assert.doesNotMatch(productModel, /branch\s+Branch\?\s+@relation\([^\n]*(?:onDelete|onUpdate)/);
assert.match(productModel, /@@index\(\[branchId\]\)/);
assert.match(productModel, /@@index\(\[branchId, active\]\)/);
assert.match(productModel, /@@index\(\[branchId, productTypeId\]\)/);
assert.match(productModel, /@@index\(\[branchId, templateProductId\]\)/);

assert.match(sql, /ALTER TABLE "public"\."Product" ADD COLUMN\s+"branchId" INTEGER/);
assert.match(sql, /FOREIGN KEY \("branchId"\) REFERENCES "public"\."Branch"\("id"\) ON DELETE SET NULL ON UPDATE CASCADE/);
for (const name of [
  'Product_branchId_idx',
  'Product_branchId_active_idx',
  'Product_branchId_productTypeId_idx',
  'Product_branchId_templateProductId_idx',
]) assert.match(sql, new RegExp(`CREATE INDEX "${name}"`));

assert.ok(!/\bUPDATE\s+"Product"/i.test(sql));
assert.ok(!/\bDELETE\s+FROM\b/i.test(sql));
assert.ok(!/\bINSERT\s+INTO\b/i.test(sql));
assert.ok(!/\b(?:DROP|TRUNCATE)\b/i.test(sql));
console.log('Product ownership additive Prisma migration contract: PASS');
