'use strict'

const repository = require('./partnerStoreApplicationRepository')

const fail = (statusCode, code, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  throw error
}

const positiveId = (value, statusCode, code) => {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) fail(statusCode, code, 'Invalid identifier')
  return id
}

const resultSelect = {
  id: true,
  applicationCode: true,
  status: true,
  provisioningStatus: true,
  activationStatus: true,
  provisionedBranchId: true,
  provisionedOwnerUserId: true,
  provisioningAttemptedAt: true,
  provisionedAt: true,
  activatedAt: true,
  provisioningFailureCode: true,
}

const markFailed = async (applicationId, actorUserId, sourceStatus, error) => {
  const failureCode = String(error?.code || 'PARTNER_STORE_PROVISIONING_FAILED').slice(0, 120)

  await repository.withTransaction(async (tx) => {
    const changed = await tx.partnerStoreApplication.updateMany({
      where: {
        id: applicationId,
        status: 'APPROVED',
        provisioningStatus: { in: ['NOT_STARTED', 'FAILED'] },
        provisionedBranchId: null,
      },
      data: {
        provisioningStatus: 'FAILED',
        provisioningFailureCode: failureCode,
        provisioningAttemptedAt: new Date(),
      },
    })
    if (changed.count !== 1) return

    await tx.partnerStoreApplicationEvent.create({
      data: {
        applicationId,
        eventType: 'PROVISIONING_FAILED',
        previousStatus: 'APPROVED',
        resultingStatus: 'APPROVED',
        previousProvisioningStatus: sourceStatus,
        resultingProvisioningStatus: 'FAILED',
        actorUserId,
        metadata: { failureCode },
      },
    })
  })
}

const reconcileLegacyLinkedState = async (tx, application, actorUserId) => {
  if (!application.provisionedBranchId) return null

  const needsProvisioningReconciliation = application.provisioningStatus !== 'PROVISIONED'
  const needsActivationReconciliation = Boolean(application.provisionedOwnerUserId) && application.activationStatus !== 'ACTIVE'
  if (!needsProvisioningReconciliation && !needsActivationReconciliation) return null

  const branch = await tx.branch.findUnique({
    where: { id: application.provisionedBranchId },
    select: { id: true },
  })
  if (!branch) {
    fail(409, 'PARTNER_STORE_PROVISIONED_BRANCH_MISSING', 'Provisioned branch is missing')
  }

  const existingCapability = await tx.partnerStoreCapability.findUnique({
    where: { branchId: branch.id },
    select: { id: true },
  })
  if (!existingCapability) {
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
  }

  if (needsActivationReconciliation) {
    const owner = await tx.user.findUnique({
      where: { id: application.provisionedOwnerUserId },
      select: { id: true },
    })
    if (!owner) {
      fail(409, 'PARTNER_STORE_PROVISIONED_OWNER_MISSING', 'Provisioned owner is missing')
    }
  }

  const reconciledAt = new Date()
  const where = {
    id: application.id,
    status: 'APPROVED',
    provisionedBranchId: branch.id,
  }
  const data = {}

  if (needsProvisioningReconciliation) {
    where.provisioningStatus = application.provisioningStatus
    data.provisioningStatus = 'PROVISIONED'
    data.provisionedAt = application.provisionedAt || reconciledAt
    data.provisioningFailureCode = null
  }
  if (needsActivationReconciliation) {
    where.activationStatus = application.activationStatus
    where.provisionedOwnerUserId = application.provisionedOwnerUserId
    data.activationStatus = 'ACTIVE'
    data.activatedAt = application.activatedAt || reconciledAt
  }

  const changed = await tx.partnerStoreApplication.updateMany({ where, data })
  if (changed.count !== 1) {
    const latest = await repository.findById(application.id, tx)
    const provisioningSettled = !needsProvisioningReconciliation || latest?.provisioningStatus === 'PROVISIONED'
    const activationSettled = !needsActivationReconciliation || (
      latest?.activationStatus === 'ACTIVE' && latest?.provisionedOwnerUserId === application.provisionedOwnerUserId
    )
    if (latest?.provisionedBranchId === branch.id && provisioningSettled && activationSettled) return latest
    fail(409, 'PARTNER_STORE_PROVISIONING_STATE_CHANGED', 'Provisioning state changed')
  }

  if (needsProvisioningReconciliation) {
    await tx.partnerStoreApplicationEvent.create({
      data: {
        applicationId: application.id,
        eventType: 'STORE_PROVISIONED',
        previousStatus: application.status,
        resultingStatus: application.status,
        previousProvisioningStatus: application.provisioningStatus,
        resultingProvisioningStatus: 'PROVISIONED',
        previousActivationStatus: application.activationStatus,
        resultingActivationStatus: needsActivationReconciliation ? 'ACTIVE' : application.activationStatus,
        actorUserId,
        metadata: {
          branchId: branch.id,
          reconciledLegacyState: true,
          capabilityCreated: !existingCapability,
        },
      },
    })
  }

  if (needsActivationReconciliation) {
    await tx.partnerStoreApplicationEvent.create({
      data: {
        applicationId: application.id,
        eventType: 'OWNER_ACTIVATED',
        previousStatus: application.status,
        resultingStatus: application.status,
        previousProvisioningStatus: application.provisioningStatus,
        resultingProvisioningStatus: needsProvisioningReconciliation ? 'PROVISIONED' : application.provisioningStatus,
        previousActivationStatus: application.activationStatus,
        resultingActivationStatus: 'ACTIVE',
        actorUserId,
        metadata: {
          ownerUserId: application.provisionedOwnerUserId,
          branchId: branch.id,
          reconciledLegacyState: true,
          reconciliationActorUserId: actorUserId,
        },
      },
    })
  }

  return tx.partnerStoreApplication.findUnique({ where: { id: application.id }, select: resultSelect })
}

const provision = async (applicationId, actorUserId) => {
  const id = positiveId(applicationId, 400, 'PARTNER_STORE_APPLICATION_ID_INVALID')
  const actorId = positiveId(actorUserId, 401, 'PARTNER_STORE_PROVISIONING_ACTOR_REQUIRED')
  let sourceStatus = 'NOT_STARTED'

  try {
    return await repository.withTransaction(async (tx) => {
      const application = await repository.findById(id, tx)
      if (!application) fail(404, 'PARTNER_STORE_APPLICATION_NOT_FOUND', 'Application not found')
      if (application.status !== 'APPROVED') fail(409, 'PARTNER_STORE_PROVISIONING_REQUIRES_APPROVAL', 'Approval required')

      const reconciled = await reconcileLegacyLinkedState(tx, application, actorId)
      if (reconciled) return reconciled

      if (application.provisioningStatus === 'PROVISIONED') return application
      if (application.provisioningStatus === 'IN_PROGRESS') fail(409, 'PARTNER_STORE_PROVISIONING_IN_PROGRESS', 'Provisioning in progress')

      sourceStatus = application.provisioningStatus
      const attemptedAt = new Date()
      const claimed = await tx.partnerStoreApplication.updateMany({
        where: {
          id,
          status: 'APPROVED',
          provisioningStatus: { in: ['NOT_STARTED', 'FAILED'] },
          provisionedBranchId: null,
        },
        data: {
          provisioningStatus: 'IN_PROGRESS',
          provisioningAttemptedAt: attemptedAt,
          provisioningFailureCode: null,
        },
      })
      if (claimed.count !== 1) fail(409, 'PARTNER_STORE_PROVISIONING_STATE_CHANGED', 'Provisioning state changed')

      await tx.partnerStoreApplicationEvent.create({
        data: {
          applicationId: id,
          eventType: 'PROVISIONING_STARTED',
          previousStatus: application.status,
          resultingStatus: application.status,
          previousProvisioningStatus: sourceStatus,
          resultingProvisioningStatus: 'IN_PROGRESS',
          actorUserId: actorId,
        },
      })

      const slug = application.requestedStorefrontSlug || `partner-${id}`
      const existingBranch = await tx.branch.findUnique({ where: { slug }, select: { id: true } })
      if (existingBranch) fail(409, 'PARTNER_STORE_SLUG_ALREADY_EXISTS', 'Store slug already exists')

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

      await tx.partnerStoreApplication.update({
        where: { id },
        data: {
          provisioningStatus: 'PROVISIONED',
          provisionedBranchId: branch.id,
          provisionedAt: new Date(),
          provisioningFailureCode: null,
        },
      })

      await tx.partnerStoreApplicationEvent.create({
        data: {
          applicationId: id,
          eventType: 'STORE_PROVISIONED',
          previousStatus: application.status,
          resultingStatus: application.status,
          previousProvisioningStatus: 'IN_PROGRESS',
          resultingProvisioningStatus: 'PROVISIONED',
          actorUserId: actorId,
          metadata: { branchId: branch.id },
        },
      })

      return tx.partnerStoreApplication.findUnique({ where: { id }, select: resultSelect })
    })
  } catch (error) {
    if (error?.code !== 'PARTNER_STORE_PROVISIONING_IN_PROGRESS') {
      await markFailed(id, actorId, sourceStatus, error)
    }
    throw error
  }
}

module.exports = { provision }
