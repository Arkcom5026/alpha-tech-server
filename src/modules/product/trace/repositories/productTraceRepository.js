const { prisma } = require('../../../../../lib/prisma')

const saleItemInclude = {
  sale: {
    include: {
      customer: { include: { user: { select: { id: true, email: true, loginId: true } } } },
      employee: { select: { id: true, name: true } },
      payments: {
        include: { employeeProfile: { select: { id: true, name: true } }, items: true },
        orderBy: { receivedAt: 'asc' },
      },
    },
  },
  returnItems: {
    include: {
      saleReturn: {
        include: {
          employee: { select: { id: true, name: true } },
          refundedBy: { select: { id: true, name: true } },
          refundTransaction: {
            include: { refundedBy: { select: { id: true, name: true } } },
            orderBy: { refundedAt: 'asc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
}

const productTraceInclude = {
  product: {
    include: {
      brand: true,
      productType: { include: { globalProductType: true } },
      unit: true,
      productImages: { where: { active: true }, orderBy: [{ isCover: 'desc' }, { createdAt: 'asc' }], take: 3 },
    },
  },
  branch: { include: { subdistrict: { include: { district: { include: { province: true } } } } } },
  scannedBy: { select: { id: true, name: true, v2Role: true } },
  purchaseOrderReceiptItem: {
    include: {
      receipt: {
        include: {
          supplier: true,
          purchaseOrder: { include: { supplier: true, employee: { select: { id: true, name: true } } } },
          receivedBy: { select: { id: true, name: true } },
        },
      },
      purchaseOrderItem: {
        include: { purchaseOrder: { include: { supplier: true, employee: { select: { id: true, name: true } } } } },
      },
    },
  },
  // Load only the latest SaleItem for lifecycle determination
  // Deterministic: highest id = most recent
  saleItems: { include: saleItemInclude, orderBy: { id: 'desc' }, take: 1 },
  stockMovements: {
    include: { performedBy: { select: { id: true, name: true } } },
    orderBy: { occurredAt: 'asc' },
  },
  warrantyClaims: { orderBy: { createdAt: 'asc' } },
  repairJobs: {
    include: {
      customer: { include: { user: { select: { id: true, email: true, loginId: true } } } },
      technician: { select: { id: true, name: true } },
      partsUsed: { include: { product: { include: { brand: true, unit: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  },
}

const findEmployeeAuthorizationContext = async ({ employeeId, client = prisma }) => {
  if (!employeeId) return null
  return client.employeeProfile.findUnique({
    where: { id: Number(employeeId) },
    select: { id: true, branchId: true, v2Role: true, active: true, approved: true },
  })
}

const findProductTraceByLookup = ({ lookup, branchId, client = prisma }) =>
  client.stockItem.findFirst({
    where: { branchId: Number(branchId), OR: [{ barcode: lookup }, { serialNumber: lookup }] },
    include: productTraceInclude,
  })

module.exports = { productTraceInclude, findEmployeeAuthorizationContext, findProductTraceByLookup }
