const { findInputVatRecords } = require('./inputTaxReportRuntimeRepository');

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
  const records = await findInputVatRecords({
    branchId,
    startDate: period.startDate,
    endDate: period.endDate,
  });

  const data = records.map((record) => {
    const sign = record.ledgerType === 'INPUT_VAT_ADJUSTMENT' ? -1 : 1;
    const subtotal = toNumber(record.subtotalAmount) * sign;
    const vatAmount = toNumber(record.taxAmount) * sign;
    const grandTotal = toNumber(record.totalAmount) * sign;
    const snapshot = record.documentSnapshot || {};
    const vatRate = subtotal ? Math.round((Math.abs(vatAmount / subtotal) * 100) * 100) / 100 : 0;

    return {
      id: record.id,
      taxDocumentId: Number(record.taxDocumentId),
      authority: 'INPUT_VAT_RECORD',
      ledgerType: record.ledgerType,
      date: record.documentDate,
      poNumber: snapshot.purchaseOrderCode || snapshot.poNumber || 'N/A',
      supplierTaxInvoiceDate: record.documentDate,
      supplierTaxInvoiceNumber: record.documentNumber,
      supplierName: record.supplierName || 'N/A',
      supplierTaxId: record.supplierTaxId || 'N/A',
      branchName: record.branch?.name || 'N/A',
      totalAmount: subtotal,
      vatAmount,
      grandTotal,
      vatRate,
      originalTaxDocumentId: record.originalTaxDocumentId || null,
      originalDocumentNumber: record.originalDocumentNumber || null,
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
    authority: 'INPUT_VAT_RECORD',
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
