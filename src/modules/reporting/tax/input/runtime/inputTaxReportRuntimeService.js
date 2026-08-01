const { Prisma } = require('../../../../../../lib/prisma');
const { findInputTaxReceipts } = require('./inputTaxReportRuntimeRepository');

const D = (value) => (value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value || 0));
const toNumber = (value) => (value && typeof value.toNumber === 'function' ? value.toNumber() : Number(value || 0));

const makeError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const parseYmdLocal = (value, endOfDay = false) => {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
};

const resolvePeriod = (query = {}) => {
  const startDateText = typeof query.startDate === 'string' ? query.startDate.trim() : '';
  const endDateText = typeof query.endDate === 'string' ? query.endDate.trim() : '';
  let month = Number(query.month);
  let year = Number(query.year);
  let startDate;
  let endDate;

  if (startDateText && endDateText) {
    startDate = parseYmdLocal(startDateText, false);
    endDate = parseYmdLocal(endDateText, true);
    if (!startDate || !endDate) throw makeError(400, 'รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)');
    if (startDate.getTime() > endDate.getTime()) {
      throw makeError(400, 'ช่วงวันที่ไม่ถูกต้อง (startDate ต้องไม่มากกว่า endDate)');
    }
    month = startDate.getMonth() + 1;
    year = startDate.getFullYear();
  } else {
    if (!month || !year) {
      throw makeError(400, 'กรุณาระบุช่วงวันที่ (startDate/endDate) หรือ เดือนและปีภาษี (month/year)');
    }
    startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    endDate = new Date(year, month, 0, 23, 59, 59, 999);
  }

  return { month, year, startDate, endDate, startDateText, endDateText };
};

const getInputTaxReport = async ({ user = {}, query = {} }) => {
  const branchId = Number(user.branchId);
  if (!branchId) throw makeError(403, 'ไม่สามารถระบุสาขาของผู้ใช้ได้');

  const period = resolvePeriod(query);
  const receipts = await findInputTaxReceipts({
    branchId,
    startDate: period.startDate,
    endDate: period.endDate,
  });

  const data = receipts.map((receipt) => {
    const totalAmountDec = (receipt.items || []).reduce(
      (sum, item) => sum.plus(D(item.costPrice).times(item.quantity || 0)),
      new Prisma.Decimal(0)
    );
    const vatRate = Number(receipt.vatRate || 7);
    const vatAmountDec = totalAmountDec.times(vatRate).div(100);
    const grandTotalDec = totalAmountDec.plus(vatAmountDec);

    return {
      id: receipt.id,
      date: receipt.supplierTaxInvoiceDate,
      poNumber: receipt.purchaseOrder?.code || 'N/A',
      supplierTaxInvoiceDate: receipt.supplierTaxInvoiceDate,
      supplierTaxInvoiceNumber: receipt.supplierTaxInvoiceNumber,
      supplierName: receipt.purchaseOrder?.supplier?.name || 'N/A',
      supplierTaxId: receipt.purchaseOrder?.supplier?.taxId || 'N/A',
      branchName: receipt.branch?.name || 'N/A',
      totalAmount: toNumber(totalAmountDec),
      vatAmount: toNumber(vatAmountDec),
      grandTotal: toNumber(grandTotalDec),
      vatRate,
    };
  });

  const summary = data.reduce(
    (acc, row) => ({
      totalAmount: acc.totalAmount + row.totalAmount,
      vatAmount: acc.vatAmount + row.vatAmount,
      grandTotal: acc.grandTotal + row.grandTotal,
    }),
    { totalAmount: 0, vatAmount: 0, grandTotal: 0 }
  );

  return {
    message: 'Successfully fetched input tax report.',
    data,
    summary,
    period: {
      month: period.month,
      year: period.year,
      startDate: period.startDate,
      endDate: period.endDate,
      startDateText: period.startDateText || undefined,
      endDateText: period.endDateText || undefined,
    },
  };
};

module.exports = { getInputTaxReport };
