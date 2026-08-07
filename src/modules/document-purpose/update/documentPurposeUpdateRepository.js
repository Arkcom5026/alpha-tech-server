'use strict'

const { prisma, Prisma } = require('../../../lib/prisma')

const isKnownRequestError = (error, code) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code

class DocumentPurposeUpdateRepository {
  constructor(client = prisma) {
    this.prisma = client
  }

  findCurrent({ branchId, definitionId }) {
    return this.prisma.documentPurposeDefinition.findFirst({
      where: {
        id: Number(definitionId),
        branchId: Number(branchId),
      },
    })
  }

  findEventByIdempotencyKey({ branchId, definitionId, idempotencyKey }) {
    if (!idempotencyKey) return null
    return this.prisma.documentPurposeEvent.findFirst({
      where: {
        definitionId: Number(definitionId),
        idempotencyKey,
        definition: { branchId: Number(branchId) },
      },
      include: {
        version: true,
        definition: true,
      },
    })
  }

  transaction(work) {
    return this.prisma.$transaction((tx) => work(new DocumentPurposeUpdateRepository(tx)))
  }

  updateDefinitionIfVersion({ branchId, definitionId, expectedVersion, data }) {
    return this.prisma.documentPurposeDefinition.updateMany({
      where: {
        id: Number(definitionId),
        branchId: Number(branchId),
        currentVersion: Number(expectedVersion),
      },
      data,
    })
  }

  findById({ branchId, definitionId }) {
    return this.findCurrent({ branchId, definitionId })
  }

  createVersion(data) {
    return this.prisma.documentPurposeVersion.create({ data })
  }

  createEvent(data) {
    return this.prisma.documentPurposeEvent.create({ data })
  }
}

module.exports = {
  DocumentPurposeUpdateRepository,
  isKnownRequestError,
}
