const { prisma } = require('../lib/prisma');

const productionLike = /^(production|prod)$/i.test(process.env.NODE_ENV || '');
if (productionLike && process.env.ACK_READONLY_PRODUCTION_RECONCILIATION !== 'YES') {
  throw new Error('Refusing Production reconciliation without ACK_READONLY_PRODUCTION_RECONCILIATION=YES');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL authority is required');

const sanitize = (rows) => rows.map(({ id }) => id).slice(0, 100);

async function main() {
  const sales = await prisma.sale.findMany({
    select: {
      id: true,
      totalAmount: true,
      paidAmount: true,
      statusPayment: true,
      payments: {
        select: {
          code: true,
          isCancelled: true,
          items: { select: { amount: true } },
          depositUsages: { select: { id: true, customerDepositId: true, amountUsed: true } },
        },
      },
    },
  });
  const findings = {
    salesWithoutActivePayment: [],
    paidWithoutPaymentItems: [],
    paidAmountOverTotal: [],
    paymentItemsOverTotal: [],
    depositUsedOverTotal: [],
    duplicateDepositUsage: [],
    mixedPaymentCodeFamilies: [],
  };
  for (const sale of sales) {
    const active = sale.payments.filter((payment) => !payment.isCancelled);
    const itemsTotal = active.flatMap((payment) => payment.items).reduce((sum, item) => sum + Number(item.amount), 0);
    const usages = active.flatMap((payment) => payment.depositUsages);
    if (!active.length) findings.salesWithoutActivePayment.push(sale);
    if (sale.statusPayment === 'PAID' && !active.some((payment) => payment.items.length)) findings.paidWithoutPaymentItems.push(sale);
    if (Number(sale.paidAmount) > Number(sale.totalAmount) + 0.01) findings.paidAmountOverTotal.push(sale);
    if (itemsTotal > Number(sale.totalAmount) + 0.01) findings.paymentItemsOverTotal.push(sale);
    if (usages.reduce((sum, usage) => sum + Number(usage.amountUsed), 0) > Number(sale.totalAmount) + 0.01) findings.depositUsedOverTotal.push(sale);
    if (new Set(usages.map((usage) => usage.customerDepositId)).size < usages.length) findings.duplicateDepositUsage.push(sale);
    const hasPm = active.some((payment) => payment.code.startsWith('PM-'));
    const hasPmt = active.some((payment) => payment.code.startsWith('PMT-'));
    if (hasPm && hasPmt) findings.mixedPaymentCodeFamilies.push(sale);
  }
  const report = Object.fromEntries(Object.entries(findings).map(([key, rows]) => [key, { count: rows.length, saleIds: sanitize(rows) }]));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().finally(() => prisma.$disconnect());
