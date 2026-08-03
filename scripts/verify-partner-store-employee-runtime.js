'use strict'

const assert = require('assert')
const crypto = require('crypto')

if (process.env.ALLOW_PARTNER_STORE_EMPLOYEE_RUNTIME_TEST !== 'true') {
  throw new Error(
    'Refusing runtime write: set ALLOW_PARTNER_STORE_EMPLOYEE_RUNTIME_TEST=true explicitly',
  )
}

const { prisma } = require('../lib/prisma')
const onboardingService = require('../src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeService')
const authService = require('../src/modules/auth/session/runtime/sessionAuthRuntimeService')
const { listEmployeeProfiles } = require('../src/modules/employee/query/list/listEmployeeService')
const statusService = require('../src/modules/employee/status/statusEmployeeService')

const branchSlug = String(
  process.env.PARTNER_STORE_EMPLOYEE_TEST_BRANCH_SLUG || 'test-shop',
).trim()
const token = crypto.randomBytes(6).toString('hex')
const email = `system-test-cashier-${token}@invalid.local`
const password = `Employee-${token}-Pass9`

const makeResponse = () => {
  const state = { status: 200, body: null, cookies: [] }
  return {
    state,
    status(code) {
      state.status = code
      return this
    },
    json(body) {
      state.body = body
      return this
    },
    cookie(name, value, options) {
      state.cookies.push({ name, value, options })
      return this
    },
    clearCookie() {
      return this
    },
  }
}

const cleanupTestUser = async () => {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return false

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId: user.id } })
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } })
    await tx.customerProfile.deleteMany({ where: { userId: user.id } })
    await tx.employeeProfile.deleteMany({ where: { userId: user.id } })
    await tx.user.delete({ where: { id: user.id } })
  })
  return true
}

async function main() {
  await cleanupTestUser()

  const owner = await prisma.user.findFirst({
    where: {
      enabled: true,
      employeeProfile: {
        branch: { slug: branchSlug },
        active: true,
        approved: true,
        v2Role: 'OWNER',
      },
    },
    include: {
      employeeProfile: { include: { branch: true } },
    },
  })
  assert.ok(owner, `OWNER for branch slug ${branchSlug} was not found`)

  const position = await prisma.position.findFirst({ orderBy: { id: 'asc' } })
  assert.ok(position, 'At least one Position is required for employee onboarding')

  const otherBranch = await prisma.branch.findFirst({
    where: { id: { not: owner.employeeProfile.branchId } },
    orderBy: { id: 'asc' },
  })
  assert.ok(otherBranch, 'A second branch is required for cross-tenant verification')

  const ownerActor = {
    id: owner.id,
    role: owner.role,
    profileType: 'employee',
    employeeId: owner.employeeProfile.id,
    branchId: owner.employeeProfile.branchId,
    employeeRole: owner.employeeProfile.v2Role,
  }

  const createRes = makeResponse()
  await onboardingService.addSubEmployee(
    {
      user: ownerActor,
      body: {
        name: `System Test Cashier ${token}`,
        email,
        password,
        phone: '0000000002',
        v2Role: 'CASHIER',
        positionId: position.id,
        branchId: otherBranch.id,
      },
    },
    createRes,
  )

  assert.equal(createRes.state.status, 201)
  assert.equal(createRes.state.body?.ok, true)
  assert.equal(createRes.state.body?.data?.branchId, owner.employeeProfile.branchId)
  assert.notEqual(createRes.state.body?.data?.branchId, otherBranch.id)

  const employeeId = createRes.state.body.data.employeeId
  const userId = createRes.state.body.data.userId

  const stored = await prisma.user.findUnique({
    where: { id: userId },
    include: { employeeProfile: true },
  })
  assert.ok(stored)
  assert.equal(stored.enabled, true)
  assert.equal(stored.role, 'EMPLOYEE')
  assert.equal(stored.employeeProfile.branchId, owner.employeeProfile.branchId)
  assert.equal(stored.employeeProfile.v2Role, 'CASHIER')
  assert.equal(stored.employeeProfile.active, true)
  assert.equal(stored.employeeProfile.approved, true)

  const loginRes = makeResponse()
  await authService.login(
    {
      body: { emailOrPhone: email, password, rememberMe: false },
      headers: {},
      ip: '127.0.0.1',
      socket: {},
    },
    loginRes,
  )
  assert.equal(loginRes.state.status, 200)
  assert.ok(loginRes.state.body?.accessToken)
  assert.equal(loginRes.state.body?.role, 'EMPLOYEE')
  assert.equal(
    loginRes.state.body?.profile?.branch?.id,
    owner.employeeProfile.branchId,
  )

  const meRes = makeResponse()
  await authService.getMe({ user: { id: userId } }, meRes)
  assert.equal(meRes.state.status, 200)
  assert.equal(meRes.state.body?.branchId, owner.employeeProfile.branchId)
  assert.equal(meRes.state.body?.profile?.branchId, owner.employeeProfile.branchId)

  const cashierActor = {
    id: userId,
    role: 'EMPLOYEE',
    profileType: 'employee',
    employeeId,
    branchId: owner.employeeProfile.branchId,
    employeeRole: 'CASHIER',
  }
  const forbiddenRes = makeResponse()
  await onboardingService.addSubEmployee(
    {
      user: cashierActor,
      body: {
        name: 'Forbidden Nested Employee',
        email: `forbidden-${token}@invalid.local`,
        password,
        v2Role: 'CASHIER',
        positionId: position.id,
      },
    },
    forbiddenRes,
  )
  assert.equal(forbiddenRes.state.status, 403)
  assert.equal(forbiddenRes.state.body?.code, 'EMPLOYEE_ONBOARDING_FORBIDDEN')

  const ownerList = await listEmployeeProfiles({
    actor: ownerActor,
    query: { q: email, limit: 20 },
  })
  assert.equal(ownerList.total, 1)
  assert.equal(ownerList.items[0]?.id, employeeId)

  const otherBranchList = await listEmployeeProfiles({
    actor: {
      role: 'ADMIN',
      branchId: otherBranch.id,
      employeeRole: 'OWNER',
    },
    query: { q: email, branchId: owner.employeeProfile.branchId, limit: 20 },
  })
  assert.equal(otherBranchList.total, 0)

  const disabled = await statusService.changeEmployeeStatus({
    actor: ownerActor,
    employeeId,
    body: { active: false },
  })
  assert.equal(disabled.status, 200)

  const disabledStored = await prisma.user.findUnique({
    where: { id: userId },
    include: { employeeProfile: true },
  })
  assert.equal(disabledStored.enabled, false)
  assert.equal(disabledStored.employeeProfile.active, false)

  const disabledLoginRes = makeResponse()
  await authService.login(
    {
      body: { emailOrPhone: email, password, rememberMe: false },
      headers: {},
      ip: '127.0.0.1',
      socket: {},
    },
    disabledLoginRes,
  )
  assert.equal(disabledLoginRes.state.status, 403)
  assert.equal(disabledLoginRes.state.body?.message, 'บัญชีนี้ถูกปิดใช้งาน')

  console.log(JSON.stringify({
    result: 'PASS',
    branchSlug,
    branchId: owner.employeeProfile.branchId,
    ownerUserId: owner.id,
    employeeUserId: userId,
    employeeId,
    employeeRole: stored.employeeProfile.v2Role,
    clientBranchOverrideIgnored: true,
    cashierLoginStatus: loginRes.state.status,
    authMeBranchAuthority: meRes.state.body.branchId,
    cashierCreateEmployeeStatus: forbiddenRes.state.status,
    ownerVisibleCount: ownerList.total,
    otherBranchVisibleCount: otherBranchList.total,
    disabledLoginStatus: disabledLoginRes.state.status,
    cleanedUpAfterVerification: true,
  }))

  await cleanupTestUser()
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
