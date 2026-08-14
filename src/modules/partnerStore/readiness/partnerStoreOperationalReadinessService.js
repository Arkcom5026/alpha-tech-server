'use strict'

const { prisma } = require('../../../../lib/prisma')

const fail = (statusCode, code, message, details = null) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  error.details = details
  throw error
}

const selectApplication = {
  id: true,
  applicationCode: true,
  businessName: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  status: true,
  provisioningStatus: true,
  activationStatus: true,
  onboardingStatus: true,
  operationalReadinessStatus: true,
  provisionedBranchId: true,
  provisionedOwnerUserId: true,
  operationalCertifiedAt: true,
  operationalCertifiedByUserId: true,
  operationalCertificationSnapshot: true,
  provisionedBranch: {
    select: { id: true, name: true, slug: true, address: true, phone: true },
  },
}

const findOwnerApplication = (userId, client = prisma) =>
  client.partnerStoreApplication.findUnique({
    where: { provisionedOwnerUserId: Number(userId) },
    select: selectApplication,
  })

const findCapability = (branchId, client = prisma) =>
  client.partnerStoreCapability.findUnique({
    where: { branchId: Number(branchId) },
    select: {
      id: true,
      branchId: true,
      pickupEnabled: true,
      deliveryEnabled: true,
      storefrontEnabled: true,
      storefrontSlug: true,
    },
  })

const createCheck = (key, label, ready, details = null) => ({ key, label, ready: Boolean(ready), details })

const buildAssessment = ({ application, capability }) => {
  const branch = application?.provisionedBranch || null
  const checks = [
    createCheck(
      'lifecycle',
      'Application, Provisioning, Activation และ Onboarding พร้อม',
      application?.status === 'APPROVED' &&
        application?.provisioningStatus === 'PROVISIONED' &&
        application?.activationStatus === 'ACTIVE' &&
        application?.onboardingStatus === 'COMPLETED',
      {
        applicationStatus: application?.status || null,
        provisioningStatus: application?.provisioningStatus || null,
        activationStatus: application?.activationStatus || null,
        onboardingStatus: application?.onboardingStatus || null,
      }
    ),
    createCheck(
      'branchIdentity',
      'ข้อมูลระบุตัวร้านพร้อม',
      Boolean(branch?.id && String(branch?.name || '').trim() && String(branch?.slug || '').trim()),
      { branchId: branch?.id || null, name: branch?.name || null, slug: branch?.slug || null }
    ),
    createCheck(
      'ownerContact',
      'ข้อมูลติดต่อเจ้าของร้านพร้อม',
      Boolean(String(application?.contactPhone || '').trim()),
      { contactPhone: application?.contactPhone || null }
    ),
    createCheck(
      'capability',
      'Partner Store Capability พร้อม',
      Boolean(capability?.id && capability?.branchId === branch?.id),
      { capabilityId: capability?.id || null }
    ),
    createCheck(
      'serviceMode',
      'มีช่องทางให้บริการอย่างน้อยหนึ่งแบบ',
      Boolean(capability?.pickupEnabled || capability?.deliveryEnabled),
      {
        pickupEnabled: Boolean(capability?.pickupEnabled),
        deliveryEnabled: Boolean(capability?.deliveryEnabled),
      }
    ),
  ]

  const allReady = checks.every((check) => check.ready)
  return {
    status: application?.operationalReadinessStatus || 'NOT_READY',
    certified: application?.operationalReadinessStatus === 'CERTIFIED',
    requiresCertification: application?.operationalReadinessStatus !== 'CERTIFIED',
    allReady,
    checks,
  }
}

const getOperationalReadiness = async (userId) => {
  const id = Number(userId)
  if (!Number.isInteger(id) || id <= 0) fail(401, 'PARTNER_STORE_READINESS_AUTH_REQUIRED', 'ไม่พบผู้ใช้งาน')

  const application = await findOwnerApplication(id)
  if (!application) {
    return {
      isPartnerStoreOwner: false,
      requiresCertification: false,
      operationalReadinessStatus: null,
      assessment: null,
    }
  }

  const capability = application.provisionedBranchId
    ? await findCapability(application.provisionedBranchId)
    : null
  const assessment = buildAssessment({ application, capability })

  return {
    isPartnerStoreOwner: true,
    requiresCertification: assessment.requiresCertification,
    operationalReadinessStatus: assessment.status,
    application,
    capability,
    assessment,
  }
}

const certifyOperationalReadiness = async (userId) => {
  const id = Number(userId)
  if (!Number.isInteger(id) || id <= 0) fail(401, 'PARTNER_STORE_READINESS_AUTH_REQUIRED', 'ไม่พบผู้ใช้งาน')

  return prisma.$transaction(async (tx) => {
    const application = await findOwnerApplication(id, tx)
    if (!application) fail(404, 'PARTNER_STORE_OWNER_APPLICATION_NOT_FOUND', 'ไม่พบข้อมูลร้านของบัญชีนี้')

    if (application.operationalReadinessStatus === 'CERTIFIED') {
      const capability = application.provisionedBranchId
        ? await findCapability(application.provisionedBranchId, tx)
        : null
      return {
        isPartnerStoreOwner: true,
        requiresCertification: false,
        operationalReadinessStatus: 'CERTIFIED',
        application,
        capability,
        assessment: buildAssessment({ application, capability }),
      }
    }

    const capability = application.provisionedBranchId
      ? await findCapability(application.provisionedBranchId, tx)
      : null
    const assessment = buildAssessment({ application, capability })
    if (!assessment.allReady) {
      fail(
        409,
        'PARTNER_STORE_NOT_OPERATIONALLY_READY',
        'ร้านยังไม่ผ่านเงื่อนไขความพร้อมสำหรับการรับรอง',
        { checks: assessment.checks }
      )
    }

    const now = new Date()
    const snapshot = {
      version: 2,
      certifiedAt: now.toISOString(),
      checks: assessment.checks,
      branchId: application.provisionedBranchId,
      capabilityId: capability?.id || null,
    }

    const claimed = await tx.partnerStoreApplication.updateMany({
      where: { id: application.id, operationalReadinessStatus: 'NOT_READY' },
      data: {
        operationalReadinessStatus: 'CERTIFIED',
        operationalCertifiedAt: now,
        operationalCertifiedByUserId: id,
        operationalCertificationSnapshot: snapshot,
      },
    })

    if (claimed.count === 1) {
      await tx.partnerStoreApplicationEvent.create({
        data: {
          applicationId: application.id,
          eventType: 'OPERATIONAL_CERTIFIED',
          previousStatus: application.status,
          resultingStatus: application.status,
          previousProvisioningStatus: application.provisioningStatus,
          resultingProvisioningStatus: application.provisioningStatus,
          previousActivationStatus: application.activationStatus,
          resultingActivationStatus: application.activationStatus,
          previousOnboardingStatus: application.onboardingStatus,
          resultingOnboardingStatus: application.onboardingStatus,
          previousOperationalReadinessStatus: 'NOT_READY',
          resultingOperationalReadinessStatus: 'CERTIFIED',
          actorUserId: id,
          metadata: snapshot,
        },
      })
    }

    const updated = await findOwnerApplication(id, tx)
    return {
      isPartnerStoreOwner: true,
      requiresCertification: false,
      operationalReadinessStatus: 'CERTIFIED',
      application: updated,
      capability,
      assessment: { ...assessment, status: 'CERTIFIED', certified: true, requiresCertification: false },
    }
  })
}

module.exports = { getOperationalReadiness, certifyOperationalReadiness }
