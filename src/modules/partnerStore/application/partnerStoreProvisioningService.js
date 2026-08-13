'use strict'

const repository = require('./partnerStoreApplicationRepository')

const STALE_AFTER_MS = 5 * 60 * 1000
const text = (value) => String(value || '').trim()

const fail = (statusCode, code, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  throw error
}

const assertActor = (actorUserId) => {
  const id = Number(actorUserId)
  if (!Number.isInteger(id) || id <= 0) fail(401, 'PARTNER_STORE_PROVISIONING_ACTOR_REQUIRED', 'ไม่พบผู้ดำเนินการ provisioning')
  return id
}

const selectResult = {
  id: true,
  applicationCode: true,
  status: true,
  provisioningStatus: true,
  provisionedBranchId: true,
  provisioningAttemptedAt: true,
  provisionedAt: true,
  provisioningFailureCode: true,
}

const claimProvisioning = async (applicationId, actorUserId) =>
  repository.withTransaction(async (tx) => {
    const application = await repository.findById(applicationId, tx)
    if (!application) fail(404, 'PARTNER_STORE_APPLICATION_NOT_FOUND', 'ไม่พบใบสมัครร้านพาร์ทเนอร์')
    if (application.status !== 'APPROVED') fail(409, 'PARTNER_STORE_PROVISIONING_REQUIRES_APPROVAL', 'ต้องอนุมัติใบสมัครก่อนสร้างร้าน')
    if (application.provisioningStatus === 'PROVISIONED') return { application, alreadyProvisioned: true }

    const staleBefore = new Date(Date.now() - STALE_AFTER_MS)
    const claim = await tx.partnerStoreApplication.updateMany({
      where: {
        id: application.id,
        status: 'APPROVED',
        OR: [
          { provisioningStatus: { in: ['NOT_STARTED', 'FAILED'] } },
          { provisioningStatus: 'IN_PROGRESS', provisioningAttemptedAt: { lte: staleBefore } },
        ],
      },
      data: {
        provisioningStatus: 'IN_PROGRESS',
        provisioningAttemptedAt: new Date(),
        provisioningFailureCode: null,
      },
    })

    if (claim.count !== 1) fail(409, 'PARTNER_STORE_PROVISIONING_IN_PROGRESS', 'กำลังสร้างร้านจากใบสมัครนี้อยู่ กรุณาลองใหม่ภายหลัง')

    await tx.partnerStoreApplicationEvent.create({
      data: {
        applicationId: application.id,
        eventType: 'PROVISIONING_STARTED',
        previousStatus: application.status,
        resultingStatus: application.status,
        previousProvisioningStatus: application.provisioningStatus,
        resultingProvisioningStatus: 'IN_PROGRESS',
        actorUserId,
      },
    })

    return { application: await repository.findById(application.id, tx), alreadyProvisioned: false }
  })

const markFailed = async (applicationId, actorUserId, error) => {
  const failureCode = text(error?.code || 'PARTNER_STORE_PROVISIONING_FAILED').slice(0, 120)
  await repository.withTransaction(async (tx) => {
    const application = await repository.findById(applicationId, tx)
    if (!application || application.provisioningStatus !== 'IN_PROGRESS') return

    await tx.partnerStoreApplication.update({
      where: { id: application.id },
      data: { provisioningStatus: 'FAILED', provisioningFailureCode: failureCode },
    })
    await tx.partnerStoreApplicationEvent.create({
      data: {
        applicationId: application.id,
        eventType: 'PROVISIONING_FAILED',
        previousStatus: application.status,
        resultingStatus: application.status,
        previousProvisioningStatus: 'IN_PROGRESS',
        resultingProvisioningStatus: 'FAILED',
        actorUserId,
        metadata: { failureCode },
      },
    })
  })
}

const provision = async (applicationId, actorUserId) => {
  const actorId = assertActor(actorUserId)
  const id = Number(applicationId)
  if (!Number.isInteger(id) || id <= 0) fail(400, 'PARTNER_STORE_APPLICATION_ID_INVALID', 'รหัสใบสมัครไม่ถูกต้อง')

  const claim = await claimProvisioning(id, actorId)
  if (claim.alreadyProvisioned) return claim.application

  try {
    return await repository.withTransaction(async (tx) => {
      const application = await repository.findById(id, tx)
      if (!application || application.status !== 'APPROVED' || application.provisioningStatus !== 'IN_PROGRESS') {
        fail(409, 'PARTNER_STORE_PROVISIONING_STATE_CHANGED', 'สถานะ provisioning เปลี่ยนไป กรุณาโหลดข้อมูลใหม่')
      }
      if (application.provisionedBranchId) fail(409, 'PARTNER_STORE_PROVISIONING_BRANCH_ALREADY_LINKED', 'ใบสมัครนี้มีร้านที่ provision แล้ว')

      const slug = application.requestedStorefrontSlug || `partner-${application.id}`
      const existingBranch = await tx.branch.findUnique({ where: { slug }, select: { id: true } })
      if (existingBranch) fail(409, 'PARTNER_STORE_SLUG_ALREADY_EXISTS', 'ชื่อย่อหน้าร้านนี้ถูกใช้งานแล้ว')

      const branch = await tx.branch.create({
        data: {
          name: application.businessName,
          address: application.businessAddress,
          phone: application.contactPhone,
          slug,
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

      await tx.partnerStoreCapability.create({
        data: {
          branchId: branch.id,
          displayName: application.businessName,
          contactPhone: application.contactPhone,
          storefrontEnabled: false,
          pickupEnabled: true,
          deliveryEnabled: false,
          serviceAreaMode: 'PICKUP_ONLY',
        },
      })

      const provisioned = await tx.partnerStoreApplication.update({
        where: { id: application.id },
        data: {
          provisioningStatus: 'PROVISIONED',
          provisionedBranchId: branch.id,
          provisionedAt: new Date(),
          provisioningFailureCode: null,
        },
        select: selectResult,
      })

      await tx.partnerStoreApplicationEvent.create({
        data: {
          applicationId: application.id,
          eventType: 'STORE_PROVISIONED',
          previousStatus: application.status,
          resultingStatus: application.status,
          previousProvisioningStatus: 'IN_PROGRESS',
          resultingProvisioningStatus: 'PROVISIONED',
          actorUserId: actorId,
          metadata: { branchId: branch.id },
        },
      })

      return provisioned
    })
  } catch (error) {
    await markFailed(id, actorId, error)
    throw error
  }
}

module.exports = { provision }
