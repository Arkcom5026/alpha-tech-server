'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '20260805010000_store_device_registry_durable_persistence', 'migration.sql')
const sql = fs.readFileSync(migrationPath, 'utf8')

test('creates additive branch-owned durable device registry', () => {
  assert.match(sql, /CREATE TABLE "StoreDeviceRegistryDevice"/)
  assert.match(sql, /UNIQUE INDEX "StoreDeviceRegistryDevice_branch_device_key"/)
  assert.match(sql, /FOREIGN KEY \("branchId"\) REFERENCES "Branch"\("id"\)/)
  assert.match(sql, /FOREIGN KEY \("branchId", "gatewayId"\)/)
  assert.match(sql, /REFERENCES "StoreDeviceGateway"\("branchId", "gatewayId"\)/)
})

test('persists workstation assignment and revocation safety', () => {
  assert.match(sql, /"workstationId" TEXT/)
  assert.match(sql, /"revokedAt" TIMESTAMP\(3\)/)
  assert.match(sql, /"revokedAt" IS NULL OR "connectionState" = 'REVOKED'/)
})

test('contains no destructive or data-rewrite statements', () => {
  assert.doesNotMatch(sql, /\bDROP\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bUPDATE\s+"/i)
})
