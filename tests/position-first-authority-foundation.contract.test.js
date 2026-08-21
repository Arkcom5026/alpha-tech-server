'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const schema = read('prisma/foundation/identity.prisma')
const migration = read('prisma/migrations/20260821095800_position_first_authority_foundation/migration.sql')
const verifyToken = read('middlewares/verifyToken.js')
const positionService = read('src/modules/position/runtime/positionRuntimeService.js')
const positionLookupRepository = read('src/modules/employee/lookup/positions/positionLookupRepository.js')
const onboardingService = read('src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeService.js')
const onboardingRepository = read('src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeRepository.js')

assert(schema.includes('capabilities Json?'))
assert(migration.includes('ADD COLUMN "capabilities" JSONB'))
assert(verifyToken.includes('positionCapabilities'))
assert(verifyToken.includes("positionAuthorityMode: positionCapabilities === null ? 'V2_ROLE_COMPAT' : 'POSITION'"))
assert(positionService.includes("EMPLOYEE_MANAGE: 'employee.manage'") || positionService.includes('POSITION_CAPABILITIES'))
assert(positionService.includes('data.capabilities = normalizeCapabilitiesInput(body.capabilities)'))
assert(positionLookupRepository.includes('capabilities: true'))
assert(onboardingRepository.includes('capabilities: true'))
assert(onboardingService.includes('deriveCompatibilityRoleFromPosition(position)'))
assert(onboardingService.includes('const v2Role = positionDerivedRole || requestedV2Role'))

console.log('position-first-authority-foundation.contract.test.js: PASS')
