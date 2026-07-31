const repository = require('./financeRuntimeRepository');

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const safeInt = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
};

const safeStr = (value) => (value == null ? '' : String(value).trim());

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

const mapArStatus = (value) => {
  const status = safeStr(value).toUpperCase();
  if (!status || status === 'OPEN') return ['UNPAID', 'PARTIALLY_PAID', 'WAITING_APPROVAL'];
  if (['UNPAID', 'PARTIALLY_PAID', 'WAITING_APPROVAL', 'PAID', 'CANCELLED'].includes(status)) return [status];
  if (status === 'ALL') return ['UNPAID', 'PARTIALLY_PAID', 'WAITING_APPROVAL', 'PAID', 'CANCELLED'];
  return ['UNPAID', 'PARTIALLY_PAID', 'WAITING_APPROVAL'];
};

const normalizeFilters = (query) => ({
  fromDate: safeDate(query.fromDate),
  toDate: safeDate(query.toDate),
  keyword: safeStr(query.keyword || query.searchText || query.q),
});

const pingFinance = async ({ branchId }) => ({ success: true, module: 'finance', branchId });

const getAccountsReceivableSummary = async ({ branchId, query }) => {
  const filters = normalizeFilters(query);
  const result = await repository.getAccountsReceivableSummary({
    branchId,
    statuses: mapArStatus(query.status),
    ...filters,
  });
  return {
    success: true,
    summary: {
      totalBills: result.totalBills,
      totalOutstanding: result.totalOutstanding,
      totalCustomers: result.totalCustomers,
    },
  };
};

const getAccountsReceivableRows = async ({ branchId, query }) => {
  const page = Math.max(1, safeInt(query.page) || 1);
  const pageSize = Math.min(500, Math.max(10, safeInt(query.pageSize) || 200));
  const result = await repository.getAccountsReceivableRows({
    branchId,
    statuses: mapArStatus(query.status),
    page,
    pageSize,
    ...normalizeFilters(query),
  });

  return { success: true, page, pageSize, total: result.total, rows: result.rows };
};

const getCustomerCreditSummary = async ({ branchId, query }) => {
  const result = await repository.getCustomerCreditSummary({ branchId, ...normalizeFilters(query) });
  return { success: true, summary: result };
};

const getCustomerCreditRows = async ({ branchId, query }) => {
  const page = Math.max(1, safeInt(query.page) || 1);
  const pageSize = Math.min(500, Math.max(10, safeInt(query.pageSize) || 200));
  const result = await repository.getCustomerCreditRows({
    branchId,
    page,
    pageSize,
    ...normalizeFilters(query),
  });
  return { success: true, page, pageSize, total: result.total, rows: result.rows };
};

const getCustomerCreditByCustomerId = async ({ branchId, query, params }) => {
  const customerId = safeInt(params.customerId);
  if (!customerId) {
    const error = new Error('invalid_customer_id');
    error.statusCode = 400;
    error.payload = { message: 'invalid_customer_id' };
    throw error;
  }
  const result = await repository.getCustomerCreditByCustomerId({
    branchId,
    customerId,
    ...normalizeFilters(query),
  });
  if (!result) {
    const error = new Error('customer_not_found');
    error.statusCode = 404;
    error.payload = { message: 'customer_not_found' };
    throw error;
  }
  return { success: true, data: result };
};

module.exports = {
  money,
  mapArStatus,
  pingFinance,
  getAccountsReceivableSummary,
  getAccountsReceivableRows,
  getCustomerCreditSummary,
  getCustomerCreditRows,
  getCustomerCreditByCustomerId,
};
