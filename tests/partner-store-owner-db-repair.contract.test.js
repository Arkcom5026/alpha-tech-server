'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const script = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'repair-pending-partner-store-owner.js'),
  'utf8',
)

assert.ok(script.includes("ALLOW_PARTNER_STORE_OWNER_DB_REPAIR !== 'true'"))
assert.ok(script.includes("required('PARTNER_STORE_APPLICATION_ID')"))
assert.ok(script.includes("required('PARTNER_STORE_OWNER_EMAIL')"))
assert.ok(script.includes("['PENDING', 'UNDER_REVIEW']"))
assert.ok(script.includes('application.provisionedBranchId'))
assert.ok(script.includes('application.provisionedOwnerUserId'))
assert.ok(script.includes('applicationEmail !== expectedEmail'))
assert.ok(script.includes('existingUser.enabled || existingUser.employeeProfile'))
assert.ok(script.includes("existingUser.role !== 'EMPLOYEE'"))
assert.ok(script.includes('crypto.randomBytes(48)'))
assert.ok(script.includes('bcrypt.hash(inaccessiblePassword, 12)'))
assert.ok(script.includes('enabled: false'))
assert.ok(script.includes('provisionedOwnerUserId: owner.id'))
assert.ok(script.includes("passwordResetRequired: true"))
assert.ok(!script.includes('console.log(inaccessiblePassword)'))
assert.ok(!script.includes('password: process.env'))

console.log('partner store owner DB repair contract: PASS')
