const assert = require('assert')
const fs = require('fs')
const path = require('path')

const sql = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8')

assert.match(sql, /CREATE TYPE "public"\."ProductTemplateCandidateType"/)
assert.match(sql, /POSSIBLE_DUPLICATE/)
assert.match(sql, /QUALITY_REVIEW/)
assert.match(sql, /ORPHAN_UNUSED/)
assert.match(sql, /ADD VALUE IF NOT EXISTS 'OPEN'/)
assert.match(sql, /ADD VALUE IF NOT EXISTS 'RESOLVED'/)
assert.match(sql, /ADD VALUE IF NOT EXISTS 'DISMISSED'/)
assert.match(sql, /ADD VALUE IF NOT EXISTS 'ARCHIVED'/)
assert.match(sql, /ADD VALUE IF NOT EXISTS 'DUPLICATE_RESOLVED'/)
assert.match(sql, /ALTER COLUMN "sourceBranchId" DROP NOT NULL/)
assert.match(sql, /ADD COLUMN "dedupeKey" TEXT/)
assert.match(sql, /CREATE UNIQUE INDEX "ProductTemplateCandidate_dedupeKey_key"/)

for (const destructive of [
  /DROP TABLE/i,
  /DROP COLUMN/i,
  /DELETE FROM/i,
  /TRUNCATE/i,
  /DROP TYPE/i,
]) {
  assert.ok(!destructive.test(sql), `Destructive SQL found: ${destructive}`)
}

console.log('product template catalog quality candidate transition migration: PASS')
