'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260729193000_add_store_customer_foundation/migration.sql'),
  'utf8',
);

assert.match(schema, /model StoreCustomer \{/);
assert.match(schema, /branchId\s+Int/);
assert.match(schema, /branch\s+Branch\s+@relation\(fields: \[branchId\], references: \[id\], onDelete: Restrict\)/);
assert.match(schema, /model StoreCustomerIdentityLink \{/);
assert.match(schema, /@@unique\(\[storeCustomerId, userId\]\)/);
assert.match(schema, /storeCustomerIdentityLinks\s+StoreCustomerIdentityLink\[\]/);
assert.match(schema, /storeCustomers\s+StoreCustomer\[\]/);
assert.match(schema, /enum StoreCustomerIdentityLinkStatus \{/);
assert.match(schema, /enum StoreCustomerIdentityVerificationMethod \{/);
assert.match(schema, /model CustomerProfile \{/);
assert.match(schema, /userId\s+Int\s+@unique/);
assert.match(migration, /CREATE TABLE "StoreCustomer"/);
assert.match(migration, /CREATE TABLE "StoreCustomerIdentityLink"/);
assert.match(migration, /ON DELETE RESTRICT ON UPDATE CASCADE/);
assert.match(migration, /ON DELETE CASCADE ON UPDATE CASCADE/);
assert.doesNotMatch(migration, /ALTER TABLE "CustomerProfile"/);

console.log('Store Customer Prisma Foundation contract: PASS');
