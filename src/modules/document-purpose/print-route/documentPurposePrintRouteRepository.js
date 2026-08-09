'use strict'

const { prisma } = require('../../../../lib/prisma')

const include = {
  definition: true,
  printerProfile: true,
}

const findDefinition = ({ branchId, definitionId }) => prisma.documentPurposeDefinition.findFirst({
  where: { branchId, id: definitionId },
})

const findProfile = ({ branchId, printerProfileId }) => prisma.printDeviceProfile.findFirst({
  where: { branchId, id: printerProfileId },
})

const findByDefinition = ({ branchId, definitionId }) => prisma.documentPurposePrintRoute.findUnique({
  where: { branchId_definitionId: { branchId, definitionId } },
  include,
})

const list = ({ branchId }) => prisma.documentPurposePrintRoute.findMany({
  where: { branchId },
  include,
  orderBy: [
    { definition: { sortOrder: 'asc' } },
    { definitionId: 'asc' },
  ],
})

const upsert = ({ branchId, definitionId, data }) => prisma.documentPurposePrintRoute.upsert({
  where: { branchId_definitionId: { branchId, definitionId } },
  create: { branchId, definitionId, ...data },
  update: data,
  include,
})

const disable = ({ branchId, definitionId }) => prisma.documentPurposePrintRoute.update({
  where: { branchId_definitionId: { branchId, definitionId } },
  data: { isActive: false },
  include,
})

module.exports = { disable, findByDefinition, findDefinition, findProfile, list, prisma, upsert }
