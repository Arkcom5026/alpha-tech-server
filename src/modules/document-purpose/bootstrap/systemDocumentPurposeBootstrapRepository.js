'use strict'

const { prisma, Prisma } = require('../../../lib/prisma')

const isKnownRequestError = (error, code) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code

const branchSelection = {
  id: true,
  name: true,
  branchCode: true,
  slug: true,
  categoryId: true,
  features: true,
  provisionedPartnerStoreApplications: {
    select: {
      id: true,
      provisioningStatus: true,
      operationalReadinessStatus: true,
    },
  },
}

class SystemDocumentPurposeBootstrapRepository {
  constructor(client = prisma) {
    this.prisma = client
  }

  listBranches() {
    return this.prisma.branch.findMany({
      select: branchSelection,
      orderBy: { id: 'asc' },
    })
  }

  findBranchesByIds(branchIds) {
    return this.prisma.branch.findMany({
      where: { id: { in: branchIds.map(Number) } },
      select: branchSelection,
      orderBy: { id: 'asc' },
    })
  }

  branchExists(branchId) {
    return this.prisma.branch.findUnique({
      where: { id: Number(branchId) },
      select: { id: true },
    })
  }

  findByNormalizedCodes(branchId, normalizedCodes) {
    return this.prisma.documentPurposeDefinition.findMany({
      where: {
        branchId: Number(branchId),
        normalizedCode: { in: normalizedCodes },
      },
      select: {
        id: true,
        branchId: true,
        code: true,
        normalizedCode: true,
        displayName: true,
        description: true,
        categoryCode: true,
        isSystem: true,
        lifecycleState: true,
        sortOrder: true,
        metadata: true,
        currentVersion: true,
      },
    })
  }

  transaction(work) {
    if (typeof this.prisma.$transaction !== 'function') {
      return work(this)
    }
    return this.prisma.$transaction((tx) => work(new SystemDocumentPurposeBootstrapRepository(tx)))
  }

  createDefinition(data) {
    return this.prisma.documentPurposeDefinition.create({ data })
  }

  createVersion(data) {
    return this.prisma.documentPurposeVersion.create({ data })
  }

  createEvent(data) {
    return this.prisma.documentPurposeEvent.create({ data })
  }
}

module.exports = {
  SystemDocumentPurposeBootstrapRepository,
  branchSelection,
  isKnownRequestError,
}
