const repository = require('./dailyClosingRuntimeRepository');

const PAYMENT_METHODS = ['CASH', 'TRANSFER', 'QR', 'CARD', 'E_WALLET', 'DEPOSIT', 'CHEQUE', 'OTHER'];

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber();
  return Number(value || 0);
};

const round2 = (value) => Number(Number(value || 0).toFixed(2));

const createEmptyPaymentBreakdown = () => ({
  cash: 0,
  transfer: 0,
  qr: 0,
  card: 0,
  eWallet: 0,
  deposit: 0,
  cheque: 0,
  other: 0,
  totalCollected: 0,
});

const normalizePaymentMethodKey = (method) => {
  switch (String(method || '').toUpperCase()) {
    case 'CASH': return 'cash';
    case 'TRANSFER': return 'transfer';
    case 'QR': return 'qr';
    case 'CARD': return 'card';
    case 'E_WALLET': return 'eWallet';
    case 'DEPOSIT': return 'deposit';
    case 'CHEQUE': return 'cheque';
    default: return 'other';
  }
};

const getBangkokDateString = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const assertDateString = (date, label = 'วันที่') => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '').trim())) {
    const error = new Error(`${label} ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD`);
    error.status = 400;
    throw error;
  }
};

const createBangkokStart = (date) => new Date(`${date}T00:00:00.000+07:00`);
const createBangkokEnd = (date) => new Date(`${date}T23:59:59.999+07:00`);

const resolveBangkokDateRange = (dateString) => {
  const date = String(dateString || getBangkokDateString()).trim();
  assertDateString(date, 'รูปแบบวันที่');
  const start = createBangkokStart(date);
  const end = createBangkokEnd(date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const error = new Error('วันที่ไม่ถูกต้อง');
    error.status = 400;
    throw error;
  }
  return { date, fromDate: date, toDate: date, start, end, isRange: false, label: date };
};

const resolveBangkokPeriodRange = ({ date, fromDate, toDate } = {}) => {
  const hasFrom = typeof fromDate === 'string' && fromDate.trim();
  const hasTo = typeof toDate === 'string' && toDate.trim();
  if (!hasFrom && !hasTo) return resolveBangkokDateRange(date);

  const resolvedFromDate = String(hasFrom ? fromDate : toDate).trim();
  const resolvedToDate = String(hasTo ? toDate : fromDate).trim();
  assertDateString(resolvedFromDate, 'จากวันที่');
  assertDateString(resolvedToDate, 'ถึงวันที่');

  const start = createBangkokStart(resolvedFromDate);
  const end = createBangkokEnd(resolvedToDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const error = new Error('ช่วงวันที่ไม่ถูกต้อง');
    error.status = 400;
    throw error;
  }
  if (start.getTime() > end.getTime()) {
    const error = new Error('จากวันที่ต้องไม่มากกว่าถึงวันที่');
    error.status = 400;
    throw error;
  }

  return {
    date: resolvedFromDate === resolvedToDate ? resolvedFromDate : null,
    fromDate: resolvedFromDate,
    toDate: resolvedToDate,
    start,
    end,
    isRange: resolvedFromDate !== resolvedToDate,
    label: resolvedFromDate === resolvedToDate ? resolvedFromDate : `${resolvedFromDate} ถึง ${resolvedToDate}`,
  };
};

const calculateGrossProfitFromSales = (sales) => {
  let grossProfit = 0;
  for (const sale of Array.isArray(sales) ? sales : []) {
    for (const item of Array.isArray(sale.items) ? sale.items : []) {
      grossProfit += toNumber(item.price) - toNumber(item.refundedAmount) - toNumber(item.stockItem?.costPrice);
    }
    for (const item of Array.isArray(sale.simpleItems) ? sale.simpleItems : []) {
      grossProfit += toNumber(item.price) - toNumber(item.unitCost) * toNumber(item.quantity);
    }
  }
  return round2(grossProfit);
};

const isOpenPaymentStatus = (statusPayment) =>
  ['UNPAID', 'PARTIALLY_PAID', 'WAITING_APPROVAL'].includes(String(statusPayment || '').toUpperCase());

const calculateSalesRuntimeSummary = (sales) => {
  let totalAmount = 0;
  let totalDiscount = 0;
  let vatAmount = 0;
  let paidAmount = 0;
  let creditAmount = 0;
  let creditPaidAmount = 0;
  let creditOutstandingAmount = 0;
  let creditBillCount = 0;
  let unpaidAmount = 0;
  let openBillCount = 0;
  let paidBillCount = 0;
  let partialBillCount = 0;
  let unpaidBillCount = 0;

  for (const sale of Array.isArray(sales) ? sales : []) {
    const saleTotal = toNumber(sale.totalAmount);
    const salePaid = toNumber(sale.paidAmount);
    const saleOutstanding = Math.max(0, round2(saleTotal - salePaid));
    totalAmount += saleTotal;
    totalDiscount += toNumber(sale.totalDiscount);
    vatAmount += toNumber(sale.vat);
    paidAmount += salePaid;
    if (sale.statusPayment === 'PAID' || sale.paid) paidBillCount += 1;
    if (sale.statusPayment === 'PARTIALLY_PAID') partialBillCount += 1;
    if (sale.statusPayment === 'UNPAID') unpaidBillCount += 1;

    if (Boolean(sale.isCredit) || isOpenPaymentStatus(sale.statusPayment)) {
      creditAmount += saleTotal;
      creditPaidAmount += salePaid;
      creditOutstandingAmount += saleOutstanding;
      creditBillCount += 1;
    }
    if (saleOutstanding > 0) {
      unpaidAmount += saleOutstanding;
      openBillCount += 1;
    }
  }

  const roundedTotalAmount = round2(totalAmount);
  const roundedCreditOutstanding = round2(creditOutstandingAmount);
  return {
    totalAmount: roundedTotalAmount,
    billCount: Array.isArray(sales) ? sales.length : 0,
    totalDiscount: round2(totalDiscount),
    vatAmount: round2(vatAmount),
    paidAmount: round2(paidAmount),
    unpaidAmount: round2(unpaidAmount),
    openBillCount,
    creditAmount: round2(creditAmount),
    creditPaidAmount: round2(creditPaidAmount),
    creditOutstandingAmount: roundedCreditOutstanding,
    creditBillCount,
    cashExpectedAmount: round2(Math.max(0, roundedTotalAmount - roundedCreditOutstanding)),
    statusBreakdown: { paidBillCount, partialBillCount, unpaidBillCount },
    grossProfit: calculateGrossProfitFromSales(sales),
  };
};

const getSalesSummary = async (params) =>
  calculateSalesRuntimeSummary(await repository.findSalesForClosing(params));

const getPaymentBreakdown = async (params) => {
  const rows = await repository.groupPaymentsForClosing(params);
  const payments = createEmptyPaymentBreakdown();
  for (const row of rows) {
    const key = normalizePaymentMethodKey(row.paymentMethod);
    payments[key] = round2(payments[key] + toNumber(row._sum.amount));
  }
  payments.totalCollected = round2(
    PAYMENT_METHODS.reduce((sum, method) => sum + toNumber(payments[normalizePaymentMethodKey(method)]), 0)
  );
  return payments;
};

const getDepositSignals = async (params) => {
  const [receivedAggregate, activeAggregate] = await repository.readDepositSignals(params);
  const activeTotal = toNumber(activeAggregate._sum.totalAmount);
  const activeUsed = toNumber(activeAggregate._sum.usedAmount);
  return {
    receivedTodayAmount: round2(toNumber(receivedAggregate._sum.totalAmount)),
    receivedTodayCount: Number(receivedAggregate._count._all || 0),
    receivedTodayByMethod: {
      cash: round2(toNumber(receivedAggregate._sum.cashAmount)),
      transfer: round2(toNumber(receivedAggregate._sum.transferAmount)),
      card: round2(toNumber(receivedAggregate._sum.cardAmount)),
    },
    activeAmount: round2(Math.max(0, activeTotal - activeUsed)),
    activeCount: Number(activeAggregate._count._all || 0),
  };
};

const getCustomerReceiptSignals = async (params) => {
  const { todayRows, outstanding } = await repository.readCustomerReceiptSignals(params);
  const todayByMethod = createEmptyPaymentBreakdown();
  let receivedTodayAmount = 0;
  let receivedTodayCount = 0;
  for (const row of todayRows) {
    const amount = toNumber(row._sum.totalAmount);
    const key = normalizePaymentMethodKey(row.paymentMethod);
    todayByMethod[key] = round2(todayByMethod[key] + amount);
    receivedTodayAmount += amount;
    receivedTodayCount += Number(row._count._all || 0);
  }
  todayByMethod.totalCollected = round2(receivedTodayAmount);
  return {
    receivedTodayAmount: round2(receivedTodayAmount),
    receivedTodayCount,
    receivedTodayByMethod: todayByMethod,
    outstandingAmount: round2(toNumber(outstanding._sum.remainingAmount)),
    outstandingCount: Number(outstanding._count._all || 0),
  };
};

const resolveClosingStatus = ({ expectedAmount, totalCollected, differenceAmount }) => {
  if (expectedAmount <= 0 && totalCollected <= 0) return 'NO_SALES';
  if (Math.abs(differenceAmount) <= 0.009) return 'BALANCED';
  return 'DIFFERENCE';
};

const getDailyClosingSummary = async ({ branchId, date, fromDate, toDate }) => {
  const numericBranchId = Number(branchId);
  if (!numericBranchId || Number.isNaN(numericBranchId)) {
    const error = new Error('ไม่พบข้อมูลสาขา');
    error.status = 401;
    throw error;
  }

  const range = resolveBangkokPeriodRange({ date, fromDate, toDate });
  const params = { branchId: numericBranchId, start: range.start, end: range.end };
  const [sales, payments, deposits, customerReceipts] = await Promise.all([
    getSalesSummary(params),
    getPaymentBreakdown(params),
    getDepositSignals(params),
    getCustomerReceiptSignals(params),
  ]);

  const salesTotalAmount = round2(sales.totalAmount);
  const creditOutstandingAmount = round2(sales.creditOutstandingAmount);
  const expectedAmount = round2(sales.cashExpectedAmount);
  const collectedAmount = round2(payments.totalCollected);
  const differenceAmount = round2(collectedAmount - expectedAmount);

  return {
    date: range.date,
    fromDate: range.fromDate,
    toDate: range.toDate,
    branchId: numericBranchId,
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      timezone: 'Asia/Bangkok',
      fromDate: range.fromDate,
      toDate: range.toDate,
      isRange: range.isRange,
      label: range.label,
    },
    sales,
    payments,
    closing: {
      expectedAmount,
      collectedAmount,
      differenceAmount,
      status: resolveClosingStatus({ expectedAmount, totalCollected: collectedAmount, differenceAmount }),
      salesTotalAmount,
      creditOutstandingAmount,
      creditSalesAmount: round2(sales.creditAmount),
      creditBillCount: Number(sales.creditBillCount || 0),
      cashExpectedAmount: expectedAmount,
      interpretation: creditOutstandingAmount > 0 ? 'CREDIT_AWARE_BALANCE' : 'DIRECT_SALES_PAYMENT_BALANCE',
    },
    signals: {
      returns: { enabled: false, returnAmount: 0, returnCount: 0, refundPaidAmount: 0, refundCount: 0 },
      deposits,
      customerReceipts,
      creditSales: {
        amount: round2(sales.creditAmount),
        paidAmount: round2(sales.creditPaidAmount),
        outstandingAmount: creditOutstandingAmount,
        billCount: Number(sales.creditBillCount || 0),
      },
      receivablesFromTodaySales: {
        amount: round2(sales.unpaidAmount),
        billCount: Number(sales.openBillCount || 0),
      },
    },
  };
};

module.exports = {
  getDailyClosingSummary,
  resolveBangkokDateRange,
  resolveBangkokPeriodRange,
};
