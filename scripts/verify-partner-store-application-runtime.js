'use strict'

const crypto = require('crypto')
const assert = require('assert')

if (process.env.ALLOW_PARTNER_STORE_RUNTIME_TEST !== 'true') {
  throw new Error('Refusing runtime write: set ALLOW_PARTNER_STORE_RUNTIME_TEST=true explicitly')
}

const { prisma } = require('../lib/prisma')
const applicationService = require('../src/modules/partnerStore/application/partnerStoreApplicationService')

const token = crypto.randomBytes(6).toString('hex')
const email = `system-test-partner-${token}@invalid.local`
const slug = `system-test-partner-${token}`

const countBranchBusinessData = async (branchId) => {
  const [prices, stockBalances, stockItems, sales] = await Promise.all([
    prisma.branchPrice.count({ where: { branchId } }),
    prisma.stockBalance.count({ where: { branchId } }),
    prisma.stockItem.count({ where: { branchId } }),
    prisma.sale.count({ where: { branchId } }),
  ])
  return { prices, stockBalances, stockItems, sales }
}

async function main() {
  const owner = await prisma.user.create({
    data: {
      email,
      password: crypto.randomBytes(32).toString('hex'),
      role: 'CUSTOMER',
      enabled: true,
    },
    select: { id: true },
  })

  const application = await applicationService.createApplication({
    businessName: `system-test partner ${token}`,
    contactName: 'System Test Owner',
    contactPhone: '0000000000',
    contactEmail: email,
    businessAddress: 'SYSTEM TEST ONLY',
    requestedStorefrontSlug: slug,
    note: 'Runtime verification only. Do not use for operations.',
  })

  const approved = await applicationService.approveApplication(
    application.id,
    owner.id,
    null,
    'system-test runtime verification'
  )

  assert.equal(approved.status, 'APPROVED')
  assert.ok(approved.provisionedBranchId)

  const [storedApplication, profile, capability, businessData] = await Promise.all([
    prisma.partnerStoreApplication.findUnique({ where: { id: application.id } }),
    prisma.employeeProfile.findUnique({ where: { userId: owner.id } }),
    prisma.partnerStoreCapability.findUnique({ where: { branchId: approved.provisionedBranchId } }),
    countBranchBusinessData(approved.provisionedBranchId),
  ])

  assert.equal(storedApplication.provisionedBranchId, approved.provisionedBranchId)
  assert.equal(storedApplication.provisionedOwnerUserId, owner.id)
  assert.equal(profile.branchId, approved.provisionedBranchId)
  assert.equal(profile.v2Role, 'OWNER')
  assert.equal(capability.storefrontEnabled, false)
  assert.deepEqual(businessData, { prices: 0, stockBalances: 0, stockItems: 0, sales: 0 })

  console.log(JSON.stringify({
    result: 'PASS',
    applicationCode: application.applicationCode,
    branchId: approved.provisionedBranchId,
    ownerUserId: owner.id,
    retainedTestData: true,
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
