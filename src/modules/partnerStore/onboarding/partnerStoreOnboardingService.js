'use strict'

const { prisma } = require('../../../../lib/prisma')

const fail = (statusCode, code, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  throw error
}

const selectApplication = {
  id: true,
  applicationCode: true,
  businessName: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  businessAddress: true,
  status: true,
  provisioningStatus: true,
  activationStatus: true,
  onboardingStatus: true,
  provisionedBranchId: true,
  provisionedOwnerUserId: true,
  activatedAt: true,
  firstLoginAt: true,
  onboardingStartedAt: true,
  onboardingCompletedAt: true,
  provisionedBranch: {
    select: { id: true, name: true, slug: true, address: true },
  },
}

const findOwnerApplication = (userId, client = prisma) =>
  client.partnerStoreApplication.findUnique({
    where: { provisionedOwnerUserId: userId },
    select: selectApplication,
  })

const assertReadyForOnboarding = (application) => {
  if (
    application.status !== 'APPROVED' ||
    application.provisioningStatus !== 'PROVISIONED' ||
    application.activationStatus !== 'ACTIVE' ||
    !application.provisionedBranchId ||
    !application.provisionedOwnerUserId
  ) {
    fail(409, 'PARTNER_STORE_ONBOARDING_STATE_INVALID', 'ร้านยังไม่พร้อมสำหรับขั้นตอนเริ่มใช้งานครั้งแรก')
  }
}

const eventBase = (application, actorUserId) => ({
  applicationId: application.id,
  previousStatus: application.status,
  resultingStatus: application.status,
  previousProvisioningStatus: application.provisioningStatus,
  resultingProvisioningStatus: application.provisioningStatus,
  previousActivationStatus: application.activationStatus,
  resultingActivationStatus: application.activationStatus,
  actorUserId,
})

const getOrStartOnboarding = async (userId) => {
  const id = Number(userId)
  if (!Number.isInteger(id) || id <= 0) fail(401, 'PARTNER_STORE_ONBOARDING_AUTH_REQUIRED', 'ไม่พบผู้ใช้งาน')

  const existing = await findOwnerApplication(id)
  if (!existing) {
    return { isPartnerStoreOwner: false, requiresOnboarding: false, onboardingStatus: null }
  }
  assertReadyForOnboarding(existing)
  if (existing.onboardingStatus === 'COMPLETED') {
    return {
      isPartnerStoreOwner: true,
      requiresOnboarding: false,
      onboardingStatus: existing.onboardingStatus,
      application: existing,
    }
  }

  const application = await prisma.$transaction(async (tx) => {
    const current = await findOwnerApplication(id, tx)
    if (!current) fail(404, 'PARTNER_STORE_OWNER_APPLICATION_NOT_FOUND', 'ไม่พบข้อมูลร้านของบัญชีนี้')
    assertReadyForOnboarding(current)
    if (current.onboardingStatus === 'COMPLETED') return current

    const now = new Date()
    const firstLogin = !current.firstLoginAt
    const firstStart = current.onboardingStatus === 'NOT_STARTED'
    const updated = await tx.partnerStoreApplication.update({
      where: { id: current.id },
      data: {
        firstLoginAt: current.firstLoginAt || now,
        onboardingStatus: firstStart ? 'IN_PROGRESS' : current.onboardingStatus,
        onboardingStartedAt: current.onboardingStartedAt || now,
      },
      select: selectApplication,
    })

    if (firstLogin) {
      await tx.partnerStoreApplicationEvent.create({
        data: {
          ...eventBase(current, id),
          eventType: 'OWNER_FIRST_LOGIN',
          previousOnboardingStatus: current.onboardingStatus,
          resultingOnboardingStatus: firstStart ? 'IN_PROGRESS' : current.onboardingStatus,
        },
      })
    }
    if (firstStart) {
      await tx.partnerStoreApplicationEvent.create({
        data: {
          ...eventBase(current, id),
          eventType: 'ONBOARDING_STARTED',
          previousOnboardingStatus: 'NOT_STARTED',
          resultingOnboardingStatus: 'IN_PROGRESS',
        },
      })
    }
    return updated
  })

  return {
    isPartnerStoreOwner: true,
    requiresOnboarding: application.onboardingStatus !== 'COMPLETED',
    onboardingStatus: application.onboardingStatus,
    application,
  }
}

const completeOnboarding = async (userId, payload = {}) => {
  const id = Number(userId)
  if (!Number.isInteger(id) || id <= 0) fail(401, 'PARTNER_STORE_ONBOARDING_AUTH_REQUIRED', 'ไม่พบผู้ใช้งาน')
  if (payload.confirmStoreProfile !== true || payload.confirmOwnerContact !== true) {
    fail(400, 'PARTNER_STORE_ONBOARDING_CONFIRMATION_REQUIRED', 'กรุณายืนยันข้อมูลร้านและข้อมูลติดต่อเจ้าของร้านให้ครบถ้วน')
  }

  return prisma.$transaction(async (tx) => {
    const current = await findOwnerApplication(id, tx)
    if (!current) fail(404, 'PARTNER_STORE_OWNER_APPLICATION_NOT_FOUND', 'ไม่พบข้อมูลร้านของบัญชีนี้')
    assertReadyForOnboarding(current)
    if (current.onboardingStatus === 'COMPLETED') {
      return { isPartnerStoreOwner: true, requiresOnboarding: false, onboardingStatus: 'COMPLETED', application: current }
    }

    const now = new Date()
    const updated = await tx.partnerStoreApplication.update({
      where: { id: current.id },
      data: {
        firstLoginAt: current.firstLoginAt || now,
        onboardingStartedAt: current.onboardingStartedAt || now,
        onboardingStatus: 'COMPLETED',
        onboardingCompletedAt: now,
      },
      select: selectApplication,
    })

    await tx.partnerStoreApplicationEvent.create({
      data: {
        ...eventBase(current, id),
        eventType: 'ONBOARDING_COMPLETED',
        previousOnboardingStatus: current.onboardingStatus,
        resultingOnboardingStatus: 'COMPLETED',
        metadata: { confirmStoreProfile: true, confirmOwnerContact: true },
      },
    })

    return { isPartnerStoreOwner: true, requiresOnboarding: false, onboardingStatus: 'COMPLETED', application: updated }
  })
}

module.exports = { getOrStartOnboarding, completeOnboarding }
