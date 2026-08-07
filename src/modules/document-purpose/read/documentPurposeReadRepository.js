'use strict'

const { prisma } = require('../../../lib/prisma')

const currentProjectionSelect = Object.freeze({
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
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
})

class DocumentPurposeReadRepository {
  constructor(client = prisma) {
    this.prisma = client
  }

  list({ branchId, lifecycleState, categoryCode, includeArchived = false }) {
    return this.prisma.documentPurposeDefinition.findMany({
      where: {
        branchId: Number(branchId),
        ...(lifecycleState ? { lifecycleState } : {}),
        ...(categoryCode ? { categoryCode } : {}),
        ...(!includeArchived && !lifecycleState ? { lifecycleState: { not: 'ARCHIVED' } } : {}),
      },
      select: currentProjectionSelect,
      orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }, { id: 'asc' }],
    })
  }

  findById({ branchId, definitionId }) {
    return this.prisma.documentPurposeDefinition.findFirst({
      where: {
        id: Number(definitionId),
        branchId: Number(branchId),
      },
      select: currentProjectionSelect,
    })
  }

  findByCode({ branchId, normalizedCode }) {
    return this.prisma.documentPurposeDefinition.findUnique({
      where: {
        branchId_normalizedCode: {
          branchId: Number(branchId),
          normalizedCode,
        },
      },
      select: currentProjectionSelect,
    })
  }

  listVersions({ branchId, definitionId }) {
    return this.prisma.documentPurposeVersion.findMany({
      where: {
        definitionId: Number(definitionId),
        definition: { branchId: Number(branchId) },
      },
      orderBy: [{ version: 'asc' }, { id: 'asc' }],
    })
  }

  listEvents({ branchId, definitionId }) {
    return this.prisma.documentPurposeEvent.findMany({
      where: {
        definitionId: Number(definitionId),
        definition: { branchId: Number(branchId) },
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    })
  }
}

module.exports = {
  DocumentPurposeReadRepository,
  currentProjectionSelect,
}
