'use strict';

const repository = require('./supplierPayableAgingRepository');

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const emptyBuckets = () => ({
  notDue: 0,
  overdue1To30: 0,
  overdue31To60: 0,
  overdue61To90: 0,
  overdue90Plus: 0,
  noDueDate: 0,
});
const bucketField = {
  NOT_DUE: 'notDue',
  OVERDUE_1_30: 'overdue1To30',
  OVERDUE_31_60: 'overdue31To60',
  OVERDUE_61_90: 'overdue61To90',
  OVERDUE_90_PLUS: 'overdue90Plus',
  NO_DUE_DATE: 'noDueDate',
};

const positiveInt = (value, field, code) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${field} must be a positive integer`), {
      code,
      statusCode: 400,
      isOperational: true,
    });
  }
  return parsed;
};

const asOfDate = (value) => {
  const text = String(value || new Date().toISOString().slice(0, 10)).trim();
  const parsed = new Date(`${text}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text)
    || Number.isNaN(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== text
  ) {
    throw Object.assign(new Error('asOf must be a valid YYYY-MM-DD date'), {
      code: 'SUPPLIER_AGING_DATE_INVALID',
      statusCode: 400,
      isOperational: true,
    });
  }
  return text;
};

const list = async (input) => {
  const branchId = positiveInt(input.branchId, 'branchId', 'SUPPLIER_AGING_BRANCH_REQUIRED');
  const supplierId = input.supplierId
    ? positiveInt(input.supplierId, 'supplierId', 'SUPPLIER_AGING_SUPPLIER_REQUIRED')
    : null;
  const asOf = asOfDate(input.asOf);
  const projection = await repository.list({ branchId, supplierId, asOf });
  const suppliers = new Map();

  const ensure = (id, name) => {
    if (!suppliers.has(id)) {
      suppliers.set(id, {
        supplierId: id,
        supplierName: name,
        payableCount: 0,
        grossOutstanding: 0,
        availableAdvance: 0,
        netExposure: 0,
        buckets: emptyBuckets(),
      });
    }
    return suppliers.get(id);
  };

  for (const payable of projection.payables) {
    const statement = ensure(payable.supplierId, payable.supplierName);
    statement.payableCount += 1;
    statement.grossOutstanding = money(statement.grossOutstanding + payable.outstandingAmount);
    const field = bucketField[payable.bucket];
    statement.buckets[field] = money(statement.buckets[field] + payable.outstandingAmount);
  }
  for (const advance of projection.advances) {
    ensure(advance.supplierId, advance.supplierName).availableAdvance = advance.availableAdvance;
  }

  const statementRows = [...suppliers.values()]
    .map((statement) => ({
      ...statement,
      netExposure: money(Math.max(0, statement.grossOutstanding - statement.availableAdvance)),
    }))
    .sort((a, b) => b.netExposure - a.netExposure || a.supplierName.localeCompare(b.supplierName, 'th'));
  const totals = statementRows.reduce((result, statement) => ({
    grossOutstanding: money(result.grossOutstanding + statement.grossOutstanding),
    availableAdvance: money(result.availableAdvance + statement.availableAdvance),
    netExposure: money(result.netExposure + statement.netExposure),
    payableCount: result.payableCount + statement.payableCount,
    buckets: Object.fromEntries(Object.keys(result.buckets).map((key) => [
      key,
      money(result.buckets[key] + statement.buckets[key]),
    ])),
  }), {
    grossOutstanding: 0,
    availableAdvance: 0,
    netExposure: 0,
    payableCount: 0,
    buckets: emptyBuckets(),
  });

  return { asOf, totals, suppliers: statementRows, payables: projection.payables };
};

module.exports = Object.freeze({ list });
