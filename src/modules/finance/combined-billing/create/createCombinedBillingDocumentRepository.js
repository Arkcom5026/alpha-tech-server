const { Prisma } = require('../../../../../lib/prisma');
const { resolveFinancialCustomerGroup } = require('../../../customer/financial-group/customerFinancialGroupResolver');

const toDecimal = (value) => (
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0)
);

const generateCombinedBillingCode = async (tx, branchId, now) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const buddhistYear = now.getFullYear() + 543;
  const year = String(buddhistYear).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `CBL-${paddedBranch}${year}${month}`;

  const count = await tx.combinedBillingDocument.count({
    where: { branchId, code: { startsWith: prefix } },
  });

  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};

const createCombinedBillingDocumentRepository = ({ prisma }) => ({
  create: ({ branchId, employeeId, saleIds, note, now = new Date() }) => (
    prisma.$transaction(async (tx) => {
      const sales = await tx.sale.findMany({
        where: {
          id: { in: saleIds },
          branchId,
          status: 'DELIVERED',
          combinedBillingId: null,
          customerId: { not: null },
        },
        include: { customer: true },
        orderBy: { soldAt: 'asc' },
      });

      if (sales.length === 0) {
        throw new Error('ไม่พบรายการขายที่เลือกหรือไม่สามารถรวมบิลได้');
      }

      const group = await resolveFinancialCustomerGroup(tx, { customerId: sales[0].customerId, branchId });
      const customerId = group.ownerId;
      if (!sales.every((sale) => group.memberIds.includes(sale.customerId))) {
        throw new Error('ใบส่งของต้องเป็นลูกค้ารายเดียวกัน');
      }

      const eligibleIds = new Set(sales.map((sale) => sale.id));
      const invalidIds = saleIds.filter((id) => !eligibleIds.has(id));
      if (invalidIds.length > 0) {
        throw new Error(`มีใบขายบางรายการไม่สามารถรวมได้: ${invalidIds.join(', ')}`);
      }

      const totalBeforeVat = sales.reduce(
        (sum, sale) => sum.plus(toDecimal(sale.totalBeforeDiscount)),
        new Prisma.Decimal(0),
      );
      const vatAmount = sales.reduce(
        (sum, sale) => sum.plus(toDecimal(sale.vat)),
        new Prisma.Decimal(0),
      );
      const totalAmount = sales.reduce(
        (sum, sale) => sum.plus(toDecimal(sale.totalAmount)),
        new Prisma.Decimal(0),
      );

      const code = await generateCombinedBillingCode(tx, branchId, now);
      const document = await tx.combinedBillingDocument.create({
        data: {
          code,
          note,
          createdBy: employeeId,
          customerId,
          branchId,
          totalBeforeVat,
          vatAmount,
          totalAmount,
          sales: { connect: sales.map((sale) => ({ id: sale.id })) },
        },
      });

      await tx.sale.updateMany({
        where: { id: { in: sales.map((sale) => sale.id) } },
        data: { status: 'FINALIZED' },
      });

      return document;
    }, { timeout: 30000 })
  ),
});

module.exports = {
  createCombinedBillingDocumentRepository,
  generateCombinedBillingCode,
};
