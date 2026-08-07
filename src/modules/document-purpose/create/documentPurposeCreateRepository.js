'use strict'

const { prisma, Prisma } = require('../../../lib/prisma')

const isKnownRequestError = (error, code) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code

class DocumentPurposeCreateRepository {
  constructor(client = prisma) {
    this.prisma = client
  }

  findByNormalizedCode(branchId, normalizedCode) {
    return this.prisma.documentPurposeDefinition.findUnique({
      where: {
        branchId_normalizedCode: {
          branchId: Number(branchId),
          normalizedCode,
        },
      },
      select: { id: true, branchId: true, code: true, normalizedCode: true },
    })
  }

  transaction(work) {
    return this.prisma.$transaction((tx) => work(new DocumentPurposeCreateRepository(tx)))
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
  DocumentPurposeCreateRepository,
  isKnownRequestError,
}
