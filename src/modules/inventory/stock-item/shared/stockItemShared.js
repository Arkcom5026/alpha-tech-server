const prismaModule = require('../../../../../lib/prisma')
const prisma = prismaModule?.prisma || prismaModule
const { Prisma } = require('@prisma/client')

const D = (value) => (value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0))
const toNum = (value) => (value && typeof value.toNumber === 'function' ? value.toNumber() : Number(value ?? 0))
const toInt = (value) => (value === undefined || value === null || value === '' ? undefined : Number(value))

const branchIdFrom = (req) => toInt(req?.user?.branchId)

module.exports = { prisma, D, toNum, toInt, branchIdFrom }
