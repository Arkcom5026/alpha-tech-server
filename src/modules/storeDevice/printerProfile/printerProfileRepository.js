'use strict'

const { prisma } = require('../../../../lib/prisma')

const list = ({ branchId }) => prisma.printDeviceProfile.findMany({
  where: { branchId },
  orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
})

const findById = ({ branchId, id }) => prisma.printDeviceProfile.findFirst({
  where: { branchId, id },
})

const findByCode = ({ branchId, normalizedCode }) => prisma.printDeviceProfile.findUnique({
  where: { branchId_normalizedCode: { branchId, normalizedCode } },
})

const create = ({ data }) => prisma.printDeviceProfile.create({ data })

const update = ({ branchId, id, data }) => prisma.printDeviceProfile.update({
  where: { id, branchId },
  data,
})

module.exports = { create, findByCode, findById, list, prisma, update }
