const assert = require('assert')
const fs = require('fs')
const path = require('path')

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')

const repository = read('src/modules/auth/session/runtime/sessionAuthRuntimeRepository.js')
const service = read('src/modules/auth/session/runtime/sessionAuthRuntimeService.js')

// User now owns a plural customer profile relation. Authentication must never
// reintroduce the retired singular include that crashes Prisma validation.
assert.match(repository, /customerProfiles:\s*true/)
assert.doesNotMatch(repository, /customerProfile:\s*true/)

// Login queries stay behind the session repository so relation changes have one authority.
assert.match(service, /repository\.findLoginUserByEmail/)
assert.match(service, /repository\.findLoginUserByLoginId/)
assert.match(service, /repository\.findLoginUserById/)
assert.doesNotMatch(service, /prisma\.user\.findUnique\s*\(/)
assert.doesNotMatch(service, /customerProfile:\s*true/)

// Employee login authority remains intact.
assert.match(repository, /employeeProfile:\s*\{\s*include:\s*\{\s*branch:\s*true,\s*position:\s*true/s)
assert.match(service, /if \(!user\.employeeProfile\)/)

console.log('auth-session-customer-profiles-relation.contract.test.js: PASS')
