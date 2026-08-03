'use strict'

const assert = require('assert')
const crypto = require('crypto')
const { spawn } = require('child_process')

if (process.env.ALLOW_PARTNER_STORE_HTTP_E2E_TEST !== 'true' || process.env.ALPHATECH_RUNTIME_ENV !== 'TEST') {
  throw new Error('Refusing HTTP E2E runtime write outside the dedicated Test DB wrapper.')
}

const { prisma } = require('../lib/prisma')
const jwt = require('jsonwebtoken')

const token = crypto.randomBytes(6).toString('hex')
const port = 41000 + crypto.randomInt(1000)
const baseUrl = `http://127.0.0.1:${port}`
const jwtSecret = crypto.randomBytes(32).toString('hex')
const ownerEmail = `system-test-http-owner-${token}@invalid.local`
const ownerPassword = `System-Test-${token}-A9!`

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function synchronizeIdentitySequences() {
  for (const tableName of ['User', 'EmployeeProfile']) {
    await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"${tableName}"', 'id'),
        COALESCE((SELECT MAX(id) FROM "${tableName}"), 1),
        EXISTS (SELECT 1 FROM "${tableName}")
      )
    `)
  }
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Test HTTP server exited before readiness (code ${child.exitCode}).`)
    try {
      const response = await fetch(`${baseUrl}/__test-readiness__`)
      if (response.status === 404) return
    } catch (_) {
      // The server is still binding the local test port.
    }
    await sleep(100)
  }
  throw new Error('Timed out waiting for the local Test DB HTTP server.')
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('close', resolve)),
    sleep(5000),
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  return { status: response.status, body: await response.json() }
}

async function main() {
  await synchronizeIdentitySequences()

  const adminBranch = await prisma.branch.create({
    data: {
      name: `system-test http admin ${token}`,
      address: 'SYSTEM TEST ONLY',
      phone: '0000000000',
      slug: `system-test-http-admin-${token}`,
      businessType: 'GENERAL',
      category: {
        connectOrCreate: {
          where: { name: 'System Partner Store' },
          create: { name: 'System Partner Store', active: true, isSystem: true },
        },
      },
    },
    select: { id: true },
  })

  const adminUser = await prisma.user.create({
    data: {
      email: `system-test-http-admin-${token}@invalid.local`,
      password: crypto.randomBytes(32).toString('hex'),
      role: 'SUPERADMIN',
      enabled: true,
      employeeProfile: {
        create: {
          branchId: adminBranch.id,
          name: 'System Test Superadmin',
          phone: '0000000000',
          approved: true,
          active: true,
          v2Role: 'OWNER',
        },
      },
    },
    select: { id: true },
  })

  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: jwtSecret,
      CORS_ALLOW_ALL: 'false',
    },
    stdio: 'inherit',
  })

  try {
    await waitForServer(child)

    const submitted = await request('/api/public/partner-store-applications', {
      method: 'POST',
      body: JSON.stringify({
        businessName: `system-test HTTP partner ${token}`,
        contactName: 'System Test Owner',
        contactPhone: '0000000000',
        contactEmail: ownerEmail,
        password: ownerPassword,
        businessAddress: 'SYSTEM TEST ONLY',
        requestedStorefrontSlug: `system-test-http-partner-${token}`,
        note: 'HTTP E2E verification only. Do not use for operations.',
      }),
    })

    assert.equal(submitted.status, 201)
    assert.equal(submitted.body.success, true)
    assert.ok(submitted.body.data?.id)

    const pendingApplication = await prisma.partnerStoreApplication.findUnique({
      where: { id: submitted.body.data.id },
      select: { provisionedOwnerUserId: true },
    })
    assert.ok(pendingApplication?.provisionedOwnerUserId)

    const ownerUserId = pendingApplication.provisionedOwnerUserId
    const reservedOwnerBeforeApproval = await prisma.user.findUnique({ where: { id: ownerUserId } })
    assert.equal(reservedOwnerBeforeApproval.enabled, false)
    assert.equal(reservedOwnerBeforeApproval.email, ownerEmail)

    const anonymousApproval = await request(`/api/partner-store/applications/${submitted.body.data.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewNote: 'Anonymous approval must be rejected' }),
    })
    assert.equal(anonymousApproval.status, 401)

    const adminToken = jwt.sign({ id: adminUser.id }, jwtSecret, { expiresIn: '5m' })
    const approved = await request(`/api/partner-store/applications/${submitted.body.data.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reviewNote: 'System Test HTTP E2E approval' }),
    })

    assert.equal(approved.status, 200)
    assert.equal(approved.body.success, true)
    assert.equal(approved.body.data?.status, 'APPROVED')
    assert.ok(approved.body.data?.provisionedBranchId)

    const repeatedApproval = await request(`/api/partner-store/applications/${submitted.body.data.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reviewNote: 'Repeated approval must be rejected' }),
    })
    assert.equal(repeatedApproval.status, 409)
    assert.equal(repeatedApproval.body.code, 'PARTNER_STORE_APPLICATION_NOT_ACTIONABLE')

    const [application, ownerAfterApproval, profile, capability] = await Promise.all([
      prisma.partnerStoreApplication.findUnique({ where: { id: submitted.body.data.id } }),
      prisma.user.findUnique({ where: { id: ownerUserId } }),
      prisma.employeeProfile.findUnique({ where: { userId: ownerUserId } }),
      prisma.partnerStoreCapability.findUnique({ where: { branchId: approved.body.data.provisionedBranchId } }),
    ])

    assert.equal(application.status, 'APPROVED')
    assert.equal(application.provisionedOwnerUserId, ownerUserId)
    assert.equal(ownerAfterApproval.enabled, true)
    assert.equal(ownerAfterApproval.role, 'ADMIN')
    assert.equal(profile.branchId, approved.body.data.provisionedBranchId)
    assert.equal(profile.v2Role, 'OWNER')
    assert.equal(capability.storefrontEnabled, false)

    console.log(JSON.stringify({
      result: 'PASS',
      applicationCode: application.applicationCode,
      branchId: application.provisionedBranchId,
      ownerUserId,
      ownerEnabledBeforeApproval: false,
      ownerEnabledAfterApproval: true,
      clientOwnerUserIdIgnored: true,
      retainedTestData: true,
      httpRoutes: [
        'POST /api/public/partner-store-applications',
        'POST /api/partner-store/applications/:id/approve',
      ],
      accessControl: { anonymousApproval: 401, repeatedApproval: 409 },
    }))
  } finally {
    await stopServer(child)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
