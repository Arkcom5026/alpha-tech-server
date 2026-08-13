const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const foundation = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260730030000_partner_store_application_foundation/migration.sql'),
  'utf8'
)

assert.ok(foundation.includes('An application never creates a Branch or operating identity.'))

console.log('partner store application intake authority v2 contract: PASS')
