'use strict'

const { prisma } = require('../../../../lib/prisma')

const publicSelect = {
  id: true,
  applicationCode: true,
  businessName: true,
  status: true,
  provisioningStatus: true,
  activationStatus: true,
  createdAt: true,
}

const adminSelect = {
  id: true,
  applicationCode: true,
  businessName: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  businessAddress: true,
  requestedStorefrontSlug: true,
  note: true,
  status: true,
  provisioningStatus: true,
  activationStatus: true,
  reviewNote: true,
  provisionedBranchId: true,
  provisionedOwnerUserId: true,
  decidedAt: true,
  provisioningAttemptedAt: true,
  provisionedAt: true,
  provisioningFailureCode: true,
  activatedAt: true,
  createdAt: true,
  updatedAt: true,
}

const create = (data, client = prisma) =>
  client.partnerStoreApplication.create({ data, select: publicSelect })

const findById = (id, client = prisma) =>
  client.partnerStoreApplication.findUnique({ where: { id }, select: adminSelect })

const list = (status, client = prisma) =>
  client.partnerStoreApplication.findMany({
    where: status ? { status } : undefined,
    select: adminSelect,
    orderBy: { createdAt: 'desc' },
  })

const withTransaction = (handler) => prisma.$transaction(handler)

module.exports = { create, findById, list, withTransaction }
