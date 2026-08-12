const prismaImport = require('../../../../lib/prisma');
const prisma = prismaImport?.prisma || prismaImport;
const { resolveFinancialCustomerGroup } = require('../../customer/financial-group/customerFinancialGroupResolver');
const {
  buildActiveCreditReceivableWhere,
  calculateOutstandingReceivable,
} = require('../../sales/shared/creditReceivableAuthority');

const money = (value) => {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
  if (typeof value?.toNumber === 'function') {
    const number = value.toNumber();
    return Number.isFinite(number) ? number : 0;
  }
  const number = Number(value?.toString?.() ?? value);
  return Number.isFinite(number) ? number : 0;
};

const withDateRange = (where, fromDate, toDate) => {
  if (!fromDate && !toDate) return where;
  const soldAt = {};
  if (fromDate) soldAt.gte = fromDate;
  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    soldAt.lte = end;
  }
  return { ...where, soldAt };
};

const findCustomerIds = async (keyword, take = 5000) => {
  if (!keyword || !prisma?.customerProfile?.findMany) return null;
  try {
    const customers = await prisma.customerProfile.findMany({
      where: {
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { companyName: { contains: keyword, mode: 'insensitive' } },
          { taxId: { contains: keyword, mode: 'insensitive' } },
          { departmentName: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take,
    });
    return (customers || []).map((customer) => customer.id).filter(Boolean);
  } catch (_error) {
    return null;
  }
};

const buildArWhere = async ({ branchId, statuses, fromDate, toDate, keyword }) => {
  let where = withDateRange({ branchId, statusPayment: { in: statuses } }, fromDate, toDate);
  if (!keyword) return where;
  const customerIds = await findCustomerIds(keyword, 2000);
  where.OR = [
    { code: { contains: keyword, mode: 'insensitive' } },
    { refCode: { contains: keyword, mode: 'insensitive' } },
    { officialDocumentNumber: { contains: keyword, mode: 'insensitive' } },
  ];
  if (customerIds?.length) where.OR.push({ customerId: { in: customerIds } });
  return where;
};

const loadCustomerMap = async (customerIds) => {
  if (!customerIds.length || !prisma?.customerProfile?.findMany) return new Map();
  try {
    const customers = await prisma.customerProfile.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, branchId: true, name: true, companyName: true, departmentName: true, taxId: true, creditLimit: true, financialOwnerCustomerId: true },
    });
    return new Map((customers || []).map((customer) => [customer.id, customer]));
  } catch (_error) {
    return new Map();
  }
};

const getAccountsReceivableSummary = async (input) => {
  const where = await buildArWhere(input);
  const [aggregate, customers] = await Promise.all([
    prisma.sale.aggregate({
      where,
      _sum: { totalAmount: true, paidAmount: true },
      _count: { _all: true },
    }),
    prisma.sale.groupBy({
      by: ['customerId'],
      where: { ...where, customerId: { not: null } },
    }),
  ]);
  const customerIds = (customers || []).map((row) => row.customerId).filter(Boolean);
  const customerMap = await loadCustomerMap(customerIds);
  return {
    totalBills: Number(aggregate?._count?._all || 0),
    totalOutstanding: Math.max(0, money(aggregate?._sum?.totalAmount) - money(aggregate?._sum?.paidAmount)),
    totalCustomers: (customers || []).map((row) => row.customerId).filter(Boolean).length,
    totalFinancialGroups: new Set(customerIds.map((id) => customerMap.get(id)?.financialOwnerCustomerId || id)).size,
  };
};

const getAccountsReceivableRows = async (input) => {
  const where = await buildArWhere(input);
  const [rows, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: [{ soldAt: 'desc' }, { id: 'desc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        code: true,
        soldAt: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        statusPayment: true,
        isCredit: true,
        refCode: true,
        officialDocumentNumber: true,
        customerId: true,
      },
    }),
    prisma.sale.count({ where }),
  ]);
  const customerMap = await loadCustomerMap(Array.from(new Set((rows || []).map((row) => row.customerId).filter(Boolean))));
  return {
    total,
    rows: (rows || []).map((row) => {
      const totalAmount = money(row.totalAmount);
      const paidAmount = money(row.paidAmount);
      const customer = row.customerId ? customerMap.get(row.customerId) || null : null;
      return {
        id: row.id,
        saleId: row.id,
        code: row.code,
        saleCode: row.code,
        soldAt: row.soldAt,
        dueDate: row.dueDate,
        statusPayment: row.statusPayment,
        totalAmount,
        paidAmount,
        outstandingAmount: Math.max(0, totalAmount - paidAmount),
        customerId: row.customerId,
        financialOwnerCustomerId: customer?.financialOwnerCustomerId || customer?.id || null,
        customerName: String(customer?.companyName || customer?.name || '').trim(),
        customer,
        refCode: row.refCode || null,
        officialDocumentNumber: row.officialDocumentNumber || null,
      };
    }),
  };
};

const buildCreditWhere = async ({ branchId, fromDate, toDate, keyword }) => {
  let where = withDateRange({
    ...buildActiveCreditReceivableWhere({ branchId }),
    customerId: { not: null },
  }, fromDate, toDate);
  const ids = await findCustomerIds(keyword);
  if (keyword && ids) where.customerId = { in: ids };
  return { where, noMatches: Boolean(keyword && ids && ids.length === 0) };
};

const groupCredit = async (where) => {
  try {
    return await prisma.sale.groupBy({
      by: ['customerId'],
      where,
      _sum: { totalAmount: true, paidAmount: true },
    });
  } catch (_error) {
    const rows = await prisma.sale.findMany({
      where,
      select: { customerId: true, totalAmount: true, paidAmount: true },
      take: 500000,
    });
    const totals = new Map();
    for (const row of rows || []) {
      if (!row.customerId) continue;
      const outstanding = calculateOutstandingReceivable(row);
      totals.set(row.customerId, (totals.get(row.customerId) || 0) + outstanding);
    }
    return Array.from(totals, ([customerId, outstanding]) => ({
      customerId,
      __fallbackOutstanding: outstanding,
      _sum: { totalAmount: outstanding, paidAmount: 0 },
    }));
  }
};

const toCreditRows = async (grouped) => {
  const customerIds = (grouped || []).map((row) => row.customerId).filter(Boolean);
  const customerMap = await loadCustomerMap(customerIds);
  const memberRows = (grouped || []).map((row) => {
    const customer = customerMap.get(row.customerId) || null;
    const outstandingAmount = row.__fallbackOutstanding ?? calculateOutstandingReceivable({ totalAmount: row?._sum?.totalAmount, paidAmount: row?._sum?.paidAmount });
    const creditLimit = money(customer?.creditLimit);
    return {
      customerId: row.customerId,
      financialOwnerCustomerId: customer?.financialOwnerCustomerId || row.customerId,
      customerName: String(customer?.companyName || customer?.name || '').trim(),
      customer,
      outstandingAmount,
      creditLimit,
      remainingLimit: Math.max(0, creditLimit - outstandingAmount),
    };
  });
  const owners = new Map();
  for (const row of memberRows) {
    const ownerId = row.financialOwnerCustomerId;
    const current = owners.get(ownerId) || { financialOwnerCustomerId: ownerId, outstandingAmount: 0, members: [] };
    current.outstandingAmount += row.outstandingAmount;
    current.members.push({ customerId: row.customerId, departmentName: row.customer?.departmentName || null, outstandingAmount: row.outstandingAmount });
    owners.set(ownerId, current);
  }
  return memberRows.map((row) => ({ ...row, groupOutstandingAmount: owners.get(row.financialOwnerCustomerId).outstandingAmount, groupMembers: owners.get(row.financialOwnerCustomerId).members }));
};

const getCustomerCreditSummary = async (input) => {
  const { where, noMatches } = await buildCreditWhere(input);
  if (noMatches) return { totalOutstanding: 0, totalCreditLimit: 0, totalRemainingLimit: 0, customerCount: 0 };
  const rows = await toCreditRows(await groupCredit(where));
  return rows.reduce((summary, row) => ({
    totalOutstanding: summary.totalOutstanding + row.outstandingAmount,
    totalCreditLimit: summary.totalCreditLimit + row.creditLimit,
    totalRemainingLimit: summary.totalRemainingLimit + row.remainingLimit,
    customerCount: summary.customerCount + 1,
  }), { totalOutstanding: 0, totalCreditLimit: 0, totalRemainingLimit: 0, customerCount: 0 });
};

const getCustomerCreditRows = async (input) => {
  const { where, noMatches } = await buildCreditWhere(input);
  if (noMatches) return { total: 0, rows: [] };
  const rows = await toCreditRows(await groupCredit(where));
  rows.sort((a, b) => b.outstandingAmount - a.outstandingAmount || a.customerId - b.customerId);
  return {
    total: rows.length,
    rows: rows.slice((input.page - 1) * input.pageSize, input.page * input.pageSize),
  };
};

const getCustomerCreditByCustomerId = async (input) => {
  const customerMap = await loadCustomerMap([input.customerId]);
  const customer = customerMap.get(input.customerId);
  if (!customer) return null;
  const group = await resolveFinancialCustomerGroup(prisma, { customerId: input.customerId, branchId: input.branchId });
  const where = withDateRange({
    ...buildActiveCreditReceivableWhere({ branchId: input.branchId, customerIds: group.memberIds }),
  }, input.fromDate, input.toDate);
  const sales = await prisma.sale.findMany({
    where,
    orderBy: [{ soldAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      code: true,
      soldAt: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      statusPayment: true,
      refCode: true,
      officialDocumentNumber: true,
    },
  });
  const rows = (sales || []).map((sale) => {
    const totalAmount = money(sale.totalAmount);
    const paidAmount = money(sale.paidAmount);
    return { ...sale, totalAmount, paidAmount, outstandingAmount: calculateOutstandingReceivable({ totalAmount, paidAmount }) };
  });
  const outstandingAmount = rows.reduce((sum, row) => sum + row.outstandingAmount, 0);
  const creditLimit = money(customer.creditLimit);
  return {
    customer,
    financialOwner: group.owner,
    members: group.members,
    outstandingAmount,
    creditLimit,
    remainingLimit: Math.max(0, creditLimit - outstandingAmount),
    rows,
  };
};

module.exports = {
  getAccountsReceivableSummary,
  getAccountsReceivableRows,
  getCustomerCreditSummary,
  getCustomerCreditRows,
  getCustomerCreditByCustomerId,
};
