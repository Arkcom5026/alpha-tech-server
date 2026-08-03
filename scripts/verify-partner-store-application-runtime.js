'use strict'

const crypto = require('crypto')
const assert = require('assert')
const bcrypt = require('bcryptjs')

if (process.env.ALLOW_PARTNER_STORE_RUNTIME_TEST !== 'true') {
  throw new Error('Refusing runtime write: set ALLOW_PARTNER_STORE_RUNTIME_TEST=true explicitly')
}

const { prisma } = require('../lib/prisma')
const applicationService = require('../src/modules/partnerStore/application/partnerStoreApplicationService')
const applicationRepository = require('../src/modules/partnerStore/application/partnerStoreApplicationRepository')

const token = crypto.randomBytes(6).toString('hex')
const email = `system-test-partner-${token}@invalid.local`
const rejectedEmail = `system-test-partner-rejected-${token}@invalid.local`
const slug = `system-test-partner-${token}`
const password = `Runtime-${token}-Pass9`

const countBranchBusinessData = async (branchId) => {
  const [prices, stockBalances, stockItems, sales] = await Promise.all([
    prisma.branchPrice.count({ where: { branchId } }),
    prisma.stockBalance.count({ where: { branchId } }),
    prisma.stockItem.count({ where: { branchId } }),
    prisma.sale.count({ where: { branchId } }),
  ])
  return { prices, stockBalances, stockItems, sales }
}

const cleanupStalePendingRuntimeApplications = async () => {
  const stale = await prisma.partnerStoreApplication.findMany({
    where: {
      status: 'PENDING',
      contactEmail: { startsWith: 'system-test-partner-', endsWith: '@invalid.local' },
      businessAddress: { in: ['SYSTEM TEST ONLY', 'SYSTEM TEST REJECTION ONLY'] },
    },
    select: { id: true, provisionedOwnerUserId: true },
  })

  let cleaned = 0
  for (const item of stale) {
    await prisma.$transaction(async (tx) => {
      const owner = item.provisionedOwnerUserId
        ? await tx.user.findUnique({
            where: { id: item.provisionedOwnerUserId },
            include: { employeeProfile: true },
          })
        : null

      await tx.partnerStoreApplication.delete({ where: { id: item.id } })

      if (owner && owner.enabled === false && !owner.employeeProfile) {
        await tx.user.delete({ where: { id: owner.id } })
      }
    })
    cleaned += 1
  }

  return cleaned
}

async function main() {
  const cleanedStalePendingApplications = await cleanupStalePendingRuntimeApplications()

  const publicApplication = await applicationService.createApplication({
    businessName: `system-test partner ${token}`,
    contactName: 'System Test Owner',
    contactPhone: '0000000000',
    contactEmail: email,
    businessAddress: 'SYSTEM TEST ONLY',
    requestedStorefrontSlug: slug,
    password,
    note: 'Runtime verification only. Do not use for operations.',
  })

  assert.equal(publicApplication.provisionedOwnerUserId, undefined)

  const application = await applicationRepository.findById(publicApplication.id)
  assert.ok(application)
  assert.ok(application.provisionedOwnerUserId)

  const ownerUserId = application.provisionedOwnerUserId
  const reservedOwner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    include: { employeeProfile: true },
  })

  assert.ok(reservedOwner)
  assert.equal(reservedOwner.email, email)
  assert.equal(reservedOwner.enabled, false)
  assert.equal(reservedOwner.employeeProfile, null)
  assert.equal(await bcrypt.compare(password, reservedOwner.password), true)

  const approved = await applicationService.approveApplication(
    application.id,
    null,
    'system-test runtime verification'
  )

  assert.equal(approved.status, 'APPROVED')
  assert.ok(approved.provisionedBranchId)

  const [storedApplication, activeOwner, profile, capability, businessData] = await Promise.all([
    prisma.partnerStoreApplication.findUnique({ where: { id: application.id } }),
    prisma.user.findUnique({ where: { id: ownerUserId } }),
    prisma.employeeProfile.findUnique({ where: { userId: ownerUserId } }),
    prisma.partnerStoreCapability.findUnique({ where: { branchId: approved.provisionedBranchId } }),
    countBranchBusinessData(approved.provisionedBranchId),
  ])

  assert.equal(storedApplication.provisionedBranchId, approved.provisionedBranchId)
  assert.equal(storedApplication.provisionedOwnerUserId, ownerUserId)
  assert.equal(activeOwner.enabled, true)
  assert.equal(activeOwner.role, 'ADMIN')
  assert.equal(profile.branchId, approved.provisionedBranchId)
  assert.equal(profile.v2Role, 'OWNER')
  assert.equal(profile.active, true)
  assert.equal(profile.approved, true)
  assert.equal(capability.branchId, approved.provisionedBranchId)
  assert.equal(capability.storefrontEnabled, false)
  assert.deepEqual(businessData, { prices: 0, stockBalances: 0, stockItems: 0, sales: 0 })

  const publicRejectedApplication = await applicationService.createApplication({
    businessName: `system-test rejected partner ${token}`,
    contactName: 'Rejected System Test Owner',
    contactPhone: '0000000001',
    contactEmail: rejectedEmail,
    businessAddress: 'SYSTEM TEST REJECTION ONLY',
    requestedStorefrontSlug: `${slug}-rejected`,
    password,
    note: 'Runtime rejection cleanup verification only.',
  })

  const rejectedApplication = await applicationRepository.findById(publicRejectedApplication.id)
  const rejectedOwnerId = rejectedApplication.provisionedOwnerUserId
  assert.ok(rejectedOwnerId)

  const rejected = await applicationService.rejectApplication(
    rejectedApplication.id,
    'system-test rejection cleanup verification'
  )

  const [storedRejectedApplication, rejectedOwner] = await Promise.all([
    prisma.partnerStoreApplication.findUnique({ where: { id: rejectedApplication.id } }),
    prisma.user.findUnique({ where: { id: rejectedOwnerId } }),
  ])

  assert.equal(rejected.status, 'REJECTED')
  assert.equal(storedRejectedApplication.status, 'REJECTED')
  assert.equal(storedRejectedApplication.provisionedOwnerUserId, null)
  assert.equal(rejectedOwner, null)

  console.log(JSON.stringify({
    result: 'PASS',
    applicationCode: application.applicationCode,
    branchId: approved.provisionedBranchId,
    ownerUserId,
    publicResponseHidesOwnerUserId: true,
    ownerEnabledBeforeApproval: false,
    ownerEnabledAfterApproval: true,
    rejectionCleanup: 'PASS',
    cleanedStalePendingApplications,
    retainedApprovedTestData: true,
    retainedRejectedApplication: true,
    businessData,
  }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
