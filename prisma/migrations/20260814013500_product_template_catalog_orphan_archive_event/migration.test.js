const assert = require('assert')
const fs = require('fs')
const path = require('path')

const migration = fs.readFileSync(
  path.join(__dirname, 'migration.sql'),
  'utf8'
)

assert.match(
  migration,
  /ALTER TYPE\s+"public"\."ProductTemplateCandidateEventType"/
)

assert.match(
  migration,
  /ADD VALUE IF NOT EXISTS 'ORPHAN_ARCHIVED'/
)

assert.ok(!/DROP TABLE/i.test(migration))
assert.ok(!/DROP COLUMN/i.test(migration))
assert.ok(!/DROP TYPE/i.test(migration))
assert.ok(!/TRUNCATE/i.test(migration))
assert.ok(!/DELETE FROM/i.test(migration))

console.log(
  'product-template catalog orphan archive migration: PASS'
)
