'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { readPrismaSchemaSource } = require('../scripts/read-prisma-schema-source')

const root = path.resolve(__dirname, '..')
const schema = readPrismaSchemaSource(root)
const migration = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260809010000_document_printer_routing_foundation/migration.sql'),
  'utf8',
)

for (const token of [
  'model PrintDeviceProfile',
  'model DocumentPurposePrintRoute',
  '@@unique([branchId, normalizedCode])',
  '@@unique([branchId, definitionId])',
  '@relation(fields: [branchId, definitionId], references: [branchId, id]',
  '@relation(fields: [branchId, printerProfileId], references: [branchId, id]',
]) assert(schema.includes(token), `missing schema contract: ${token}`)

for (const forbidden of [/^\s*DROP\s/im, /^\s*DELETE\s+FROM\s/im, /^\s*UPDATE\s+"/im]) {
  assert(!forbidden.test(migration), `migration must remain additive: ${forbidden}`)
}
assert.match(migration, /CHECK \("copies" BETWEEN 1 AND 20\)/)

console.log('Document printer routing foundation contract: PASS')
