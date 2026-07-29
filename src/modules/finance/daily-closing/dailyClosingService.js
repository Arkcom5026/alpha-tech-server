// src/features/finance/dailyClosing.service.js
// Daily Closing Confidence V2.1 — Credit-aware + Date Range
// Source of truth:
// - Sale = sales/credit/AR movement for selected sale date/range
// - PaymentItem = collected money by payment method for selected received date/range
// - CustomerDeposit / CustomerReceipt = financial signals
// - Return flow is not active in V1/V2, so returns are reported as disabled
//
// Compatibility:
// - Supports old query: ?date=YYYY-MM-DD
// - Supports new query: ?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
//
// Key correction from V1:
// - Do NOT treat all Sale.totalAmount as cash expected today.
// - Credit sales / unpaid balances are operationally valid and must not appear as "missing money".
// - closing.expectedAmount = sales.cashExpectedAmount
//   where cashExpectedAmount = total sales - unpaid/credit outstanding from same-day/range sales.

const { prisma, Prisma } = require('../../../lib/prisma');

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
    case 'CASH':
      return 'cash';
    case 'TRANSFER':
      return 'transfer';
    case 'QR':
      return 'qr';
    case 'CARD':
      return 'card';
    case 'E_WALLET':
      return 'eWallet';
    case 'DEPOSIT':
      return 'deposit';
    case 'CHEQUE':
      return 'cheque';
    case 'OTHER':
      return 'other';
    default:
      return 'other';
  }
};

const getBangkokDateString = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
};

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

  return {
    date,
    fromDate: date,
    toDate: date,
    start,
    end,
    isRange: false,
    label: date,
  };
};

const resolveBangkokPeriodRange = ({ date, fromDate, toDate } = {}) => {
  const hasFrom = typeof fromDate === 'string' && fromDate.trim();
  const hasTo = typeof toDate === 'string' && toDate.trim();

  // Backward compatibility: old caller passes only date.
  if (!hasFrom && !hasTo) {
    return resolveBangkokDateRange(date);
  }

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
      const price = toNumber(item.price);
      const refundedAmount = toNumber(item.refundedAmount);
      const costPrice = toNumber(item.stockItem?.costPrice);
      grossProfit += price - refundedAmount - costPrice;
    }

    for (const item of Array.isArray(sale.simpleItems) ? sale.simpleItems : []) {
      const price = toNumber(item.price);
      const quantity = toNumber(item.quantity);
      const unitCost = toNumber(item.unitCost);
      grossProfit += price - unitCost * quantity;
    }
  }

  return round2(grossProfit);
};

const isOpenPaymentStatus = (statusPayment) => {
  const s = String(statusPayment || '').toUpperCase();
  return s === 'UNPAID' || s === 'PARTIALLY_PAID' || s === 'WAITING_APPROVAL';
};

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

    // Credit Reality:
    // - isCredit is the explicit business flag.
    // - Any sale with unpaid/partial/waiting status is also an open receivable signal.
    // This prevents valid credit sales from being reported as "missing money".
    const isCreditSale = Boolean(sale.isCredit) || isOpenPaymentStatus(sale.statusPayment);

    if (isCreditSale) {
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
  const roundedPaidAmount = round2(paidAmount);
  const roundedCreditOutstanding = round2(creditOutstandingAmount);
  const roundedUnpaidAmount = round2(unpaidAmount);

  // The money expected during closing should be the sale/range amount
  // that is not intentionally left as receivable/credit.
  const cashExpectedAmount = round2(Math.max(0, roundedTotalAmount - roundedCreditOutstanding));

  return {
    totalAmount: roundedTotalAmount,
    billCount: Array.isArray(sales) ? sales.length : 0,
    totalDiscount: round2(totalDiscount),
    vatAmount: round2(vatAmount),

    paidAmount: roundedPaidAmount,
    unpaidAmount: roundedUnpaidAmount,
    openBillCount,

    creditAmount: round2(creditAmount),
    creditPaidAmount: round2(creditPaidAmount),
    creditOutstandingAmount: roundedCreditOutstanding,
    creditBillCount,

    cashExpectedAmount,

    statusBreakdown: {
      paidBillCount,
      partialBillCount,
      unpaidBillCount,
    },

    grossProfit: calculateGrossProfitFromSales(sales),
  };
};

const getSalesSummary = async ({ branchId, start, end }) => {
  const where = {
    branchId,
    status: { not: 'CANCELLED' },
    soldAt: {
      gte: start,
      lte: end,
    },
  };

  const sales = await prisma.sale.findMany({
    where,
    select: {
      id: true,
      totalAmount: true,
      totalDiscount: true,
      vat: true,
      paid: true,
      paidAmount: true,
      statusPayment: true,
      isCredit: true,
      dueDate: true,
      items: {
        select: {
          price: true,
          refundedAmount: true,
          stockItem: {
            select: {
              costPrice: true,
            },
          },
        },
      },
      simpleItems: {
        select: {
          quantity: true,
          price: true,
          unitCost: true,
        },
      },
    },
  });

  return calculateSalesRuntimeSummary(sales);
};

const getPaymentBreakdown = async ({ branchId, start, end }) => {
  const rows = await prisma.paymentItem.groupBy({
    by: ['paymentMethod'],
    where: {
      payment: {
        branchId,
        isCancelled: false,
        receivedAt: {
          gte: start,
          lte: end,
        },
        sale: {
          branchId,
          status: { not: 'CANCELLED' },
        },
      },
    },
    _sum: {
      amount: true,
    },
  });

  const payments = createEmptyPaymentBreakdown();

  for (const row of rows) {
    const key = normalizePaymentMethodKey(row.paymentMethod);
    payments[key] = round2(payments[key] + toNumber(row._sum.amount));
  }

  payments.totalCollected = round2(
    PAYMENT_METHODS.reduce((sum, method) => {
      const key = normalizePaymentMethodKey(method);
      return sum + toNumber(payments[key]);
    }, 0)
  );

  return payments;
};

const getDepositSignals = async ({ branchId, start, end }) => {
  const [receivedAggregate, activeAggregate] = await Promise.all([
    prisma.customerDeposit.aggregate({
      where: {
        branchId,
        status: { not: 'CANCELLED' },
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      _count: { _all: true },
      _sum: {
        cashAmount: true,
        transferAmount: true,
        cardAmount: true,
        totalAmount: true,
        usedAmount: true,
      },
    }),
    prisma.customerDeposit.aggregate({
      where: {
        branchId,
        status: 'ACTIVE',
      },
      _count: { _all: true },
      _sum: {
        totalAmount: true,
        usedAmount: true,
      },
    }),
  ]);

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

const getCustomerReceiptSignals = async ({ branchId, start, end }) => {
  const todayRows = await prisma.customerReceipt.groupBy({
    by: ['paymentMethod'],
    where: {
      branchId,
      status: 'ACTIVE',
      receivedAt: {
        gte: start,
        lte: end,
      },
    },
    _sum: {
      totalAmount: true,
      allocatedAmount: true,
      remainingAmount: true,
    },
    _count: {
      _all: true,
    },
  });

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

  const outstanding = await prisma.customerReceipt.aggregate({
    where: {
      branchId,
      status: 'ACTIVE',
      remainingAmount: { gt: new Prisma.Decimal(0) },
    },
    _count: { _all: true },
    _sum: {
      remainingAmount: true,
    },
  });

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

  const [sales, payments, deposits, customerReceipts] = await Promise.all([
    getSalesSummary({ branchId: numericBranchId, start: range.start, end: range.end }),
    getPaymentBreakdown({ branchId: numericBranchId, start: range.start, end: range.end }),
    getDepositSignals({ branchId: numericBranchId, start: range.start, end: range.end }),
    getCustomerReceiptSignals({ branchId: numericBranchId, start: range.start, end: range.end }),
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
      // Backward-compatible fields used by the current UI
      expectedAmount,
      collectedAmount,
      differenceAmount,
      status: resolveClosingStatus({
        expectedAmount,
        totalCollected: collectedAmount,
        differenceAmount,
      }),

      // Credit-aware explanation fields for UI V2
      salesTotalAmount,
      creditOutstandingAmount,
      creditSalesAmount: round2(sales.creditAmount),
      creditBillCount: Number(sales.creditBillCount || 0),
      cashExpectedAmount: expectedAmount,
      interpretation:
        creditOutstandingAmount > 0
          ? 'CREDIT_AWARE_BALANCE'
          : 'DIRECT_SALES_PAYMENT_BALANCE',
    },
    signals: {
      returns: {
        enabled: false,
        returnAmount: 0,
        returnCount: 0,
        refundPaidAmount: 0,
        refundCount: 0,
      },
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
