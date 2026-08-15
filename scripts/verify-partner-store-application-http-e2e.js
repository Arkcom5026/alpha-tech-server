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
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch (_) { body = { raw: text } }
  return { status: response.status, body }
}

const bearer = (value) => ({ Authorization: `Bearer ${value}` })

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

  const child = spawn(process.execPath, ['src/bootstrap/server.js'], {
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
        businessAddress: 'SYSTEM TEST ONLY',
        requestedStorefrontSlug: `system-test-http-partner-${token}`,
        note: 'HTTP E2E verification only. Do not use for operations.',
      }),
    })

    assert.equal(submitted.status, 201, `Partner Store submit failed: ${JSON.stringify(submitted.body)}`)
    assert.equal(submitted.body?.success, true)
    assert.ok(submitted.body?.data?.id)
    const applicationId = submitted.body.data.id

    const adminToken = jwt.sign({ id: adminUser.id }, jwtSecret, { expiresIn: '5m' })

    const anonymousApproval = await request(`/api/partner-store/applications/${applicationId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewNote: 'Anonymous approval must be rejected' }),
    })
    assert.equal(anonymousApproval.status, 401)

    const review = await request(`/api/partner-store/applications/${applicationId}/review`, {
      method: 'POST',
      headers: bearer(adminToken),
      body: JSON.stringify({ note: 'System Test HTTP E2E review' }),
    })
    assert.equal(review.status, 200)
    assert.equal(review.body?.success, true)
    assert.equal(review.body?.data?.status, 'UNDER_REVIEW')

    const approved = await request(`/api/partner-store/applications/${applicationId}/approve`, {
      method: 'POST',
      headers: bearer(adminToken),
      body: JSON.stringify({ reviewNote: 'System Test HTTP E2E approval' }),
    })
    assert.equal(approved.status, 200)
    assert.equal(approved.body?.success, true)
    assert.equal(approved.body?.data?.status, 'APPROVED')
    assert.equal(approved.body?.data?.provisionedBranchId, null)

    const provisioned = await request(`/api/partner-store/applications/${applicationId}/provision`, {
      method: 'POST',
      headers: bearer(adminToken),
      body: JSON.stringify({}),
    })
    assert.equal(provisioned.status, 200)
    assert.equal(provisioned.body?.success, true)
    assert.equal(provisioned.body?.data?.provisioningStatus, 'PROVISIONED')
    assert.ok(provisioned.body?.data?.provisionedBranchId)
    const branchId = provisioned.body.data.provisionedBranchId

    const invitation = await request(`/api/partner-store/applications/${applicationId}/activation-invitations`, {
      method: 'POST',
      headers: bearer(adminToken),
      body: JSON.stringify({}),
    })
    assert.equal(invitation.status, 201)
    assert.equal(invitation.body?.success, true)
    assert.ok(invitation.body?.data?.token)

    const claimed = await request('/api/public/partner-store-applications/activation/claim', {
      method: 'POST',
      body: JSON.stringify({ token: invitation.body.data.token, password: ownerPassword }),
    })
    assert.equal(claimed.status, 200)
    assert.equal(claimed.body?.success, true)
    assert.equal(claimed.body?.data?.activationStatus, 'ACTIVE')
    assert.ok(claimed.body?.data?.ownerUserId)
    assert.equal(claimed.body?.data?.branchId, branchId)
    const ownerUserId = claimed.body.data.ownerUserId
    const ownerToken = jwt.sign({ id: ownerUserId }, jwtSecret, { expiresIn: '5m' })

    const onboarding = await request('/api/partner-store/onboarding/me', {
      method: 'GET',
      headers: bearer(ownerToken),
    })
    assert.equal(onboarding.status, 200)
    assert.equal(onboarding.body?.data?.isPartnerStoreOwner, true)
    assert.equal(onboarding.body?.data?.requiresOnboarding, true)

    const completedOnboarding = await request('/api/partner-store/onboarding/complete', {
      method: 'POST',
      headers: bearer(ownerToken),
      body: JSON.stringify({ confirmStoreProfile: true, confirmOwnerContact: true }),
    })
    assert.equal(completedOnboarding.status, 200)
    assert.equal(completedOnboarding.body?.data?.onboardingStatus, 'COMPLETED')

    const defaultCapability = await prisma.partnerStoreCapability.findUnique({ where: { branchId } })
    assert.equal(defaultCapability.pickupEnabled, true)
    assert.equal(defaultCapability.deliveryEnabled, false)

    await prisma.partnerStoreCapability.update({
      where: { branchId },
      data: {
        pickupEnabled: false,
        deliveryEnabled: true,
        deliveryFeeMode: 'FREE',
        serviceAreaMode: 'ADMIN_AREAS',
      },
    })

    const deliveryOnlyReadiness = await request('/api/partner-store/readiness/me', {
      method: 'GET',
      headers: bearer(ownerToken),
    })
    assert.equal(deliveryOnlyReadiness.status, 200)
    const serviceModeCheck = deliveryOnlyReadiness.body?.data?.assessment?.checks?.find((item) => item.key === 'serviceMode')
    assert.equal(serviceModeCheck?.ready, false)
    assert.equal(serviceModeCheck?.details?.certificationFulfillmentAuthority, 'PICKUP')
    assert.equal(serviceModeCheck?.details?.deliveryCertificationSupported, false)

    const rejectedDeliveryOnlyCertification = await request('/api/partner-store/readiness/certify', {
      method: 'POST',
      headers: bearer(ownerToken),
      body: JSON.stringify({}),
    })
    assert.equal(rejectedDeliveryOnlyCertification.status, 409)

    await prisma.partnerStoreCapability.update({
      where: { branchId },
      data: {
        pickupEnabled: true,
        deliveryEnabled: false,
        deliveryFeeMode: null,
        serviceAreaMode: 'PICKUP_ONLY',
      },
    })

    const certified = await request('/api/partner-store/readiness/certify', {
      method: 'POST',
      headers: bearer(ownerToken),
      body: JSON.stringify({}),
    })
    assert.equal(certified.status, 200)
    assert.equal(certified.body?.data?.operationalReadinessStatus, 'CERTIFIED')
    assert.equal(certified.body?.data?.assessment?.allReady, true)

    const storedApplication = await prisma.partnerStoreApplication.findUnique({ where: { id: applicationId } })
    assert.equal(storedApplication.status, 'APPROVED')
    assert.equal(storedApplication.provisioningStatus, 'PROVISIONED')
    assert.equal(storedApplication.activationStatus, 'ACTIVE')
    assert.equal(storedApplication.onboardingStatus, 'COMPLETED')
    assert.equal(storedApplication.operationalReadinessStatus, 'CERTIFIED')
    assert.equal(storedApplication.provisionedOwnerUserId, ownerUserId)
    assert.equal(storedApplication.provisionedBranchId, branchId)

    console.log(JSON.stringify({
      result: 'PASS',
      applicationCode: storedApplication.applicationCode,
      applicationId,
      branchId,
      ownerUserId,
      canonicalStages: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PROVISIONED', 'ACTIVE', 'ONBOARDING_COMPLETED', 'OPERATIONAL_CERTIFIED'],
      deliveryOnlyCertificationRejected: true,
      certifiedFulfillmentAuthority: 'PICKUP',
      retainedTestData: true,
      accessControl: { anonymousApproval: 401 },
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
