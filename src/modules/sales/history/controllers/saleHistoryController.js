const { prisma } = require('../../../../../lib/prisma');
const { SALE_DOCUMENT_INCLUDE } = require('../../documents/contracts/saleDocumentContract');
const {
  NORMALIZE_DECIMAL_TO_NUMBER,
  normalizeSaleMoney,
  resolveCanonicalTotalAmount,
  round2,
  toLocalRange,
  toNum,
} = require('../../shared/saleLegacyProjection');

const getAllSales = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const limitRaw = req.query?.limit;
    const limitParsed = parseInt(limitRaw, 10);
    const take = Math.min(Math.max(Number.isFinite(limitParsed) ? limitParsed : 200, 1), 500);

    const where = { branchId };

    const computeTotals = (sale) => {
      const vatRate = Number.isFinite(Number(sale?.vatRate)) ? Number(sale.vatRate) : 7;
      const totalAmount = resolveCanonicalTotalAmount(sale);
      const vatStored = sale?.vat != null ? round2(toNum(sale.vat)) : null;
      const vatAmount = vatStored != null ? vatStored : round2((totalAmount * vatRate) / (100 + vatRate));

      const beforeVat = round2(totalAmount - vatAmount);
      const totalBeforeDiscount = round2(sale?.totalBeforeDiscount != null ? toNum(sale.totalBeforeDiscount) : 0);
      const totalDiscount = round2(sale?.totalDiscount != null ? toNum(sale.totalDiscount) : 0);

      return { vatRate, totalBeforeDiscount, totalDiscount, totalAmount: round2(totalAmount), beforeVat, vatAmount };
    };

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: SALE_DOCUMENT_INCLUDE,
    });

    const normalized = NORMALIZE_DECIMAL_TO_NUMBER ? sales.map((s) => normalizeSaleMoney(s)) : sales;

    const out = normalized.map((s) => {
      const totals = computeTotals(s);
      return {
        ...s,
        vatRate: totals.vatRate,
        totalAmount: totals.totalAmount,
        totals: {
          ...(s?.totals || {}),
          totalBeforeDiscount: totals.totalBeforeDiscount,
          totalDiscount: totals.totalDiscount,
          beforeVat: totals.beforeVat,
          vatAmount: totals.vatAmount,
          total: totals.totalAmount,
        },
      };
    });

    return res.json(out);
  } catch (error) {
    console.error('❌ [getAllSales] Error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงรายการขายได้' });
  }
};

const getSaleById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid sale ID' });
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: SALE_DOCUMENT_INCLUDE,
    });

    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    if (Number(sale.branchId) !== Number(req.user?.branchId)) {
      return res.status(404).json({ error: 'ไม่พบรายการขายนี้ในสาขาของคุณ' });
    }

    const includePayments = String(req.query?.includePayments ?? '1') !== '0';
    const requestedPaymentId = req.query?.paymentId != null ? String(req.query.paymentId) : '';

    let payments = [];
    if (includePayments) {
      payments = await prisma.payment.findMany({
        where: { saleId: id },
        include: { items: true },
        orderBy: { receivedAt: 'asc' },
      });

      if (requestedPaymentId && Array.isArray(payments) && payments.length > 1) {
        payments = payments.slice().sort((a, b) => {
          const ax = String(a?.id) === requestedPaymentId ? -1 : 0;
          const bx = String(b?.id) === requestedPaymentId ? -1 : 0;
          return ax - bx;
        });
      }
    }

    const normalized = normalizeSaleMoney({ ...sale, payments });

    const totalAmount = resolveCanonicalTotalAmount(sale);
    const vatRate = round2(sale?.vatRate != null ? toNum(sale.vatRate) : 7);
    const vatStored = sale?.vat != null ? round2(toNum(sale.vat)) : null;
    const vatAmount = vatStored != null ? vatStored : round2((totalAmount * vatRate) / (100 + vatRate));
    const beforeVat = round2(totalAmount - vatAmount);
    const totalBeforeDiscount = round2(sale?.totalBeforeDiscount != null ? toNum(sale.totalBeforeDiscount) : 0);
    const totalDiscount = round2(sale?.totalDiscount != null ? toNum(sale.totalDiscount) : 0);

    const receivedAmountRaw = Array.isArray(payments)
      ? payments.reduce((sum, payment) => {
          if (payment?.isCancelled) return sum;
          const itemSum = Array.isArray(payment?.items)
            ? payment.items.reduce((itemAcc, item) => itemAcc + Number(item?.amount || 0), 0)
            : 0;
          return sum + itemSum;
        }, 0)
      : 0;

    const receivedAmount = round2(receivedAmountRaw);
    const balanceAmount = round2(Math.max(0, totalAmount - receivedAmount));
    const changeAmount = round2(Math.max(0, receivedAmount - totalAmount));

    const response = {
      ...normalized,
      totals: { totalBeforeDiscount, totalDiscount, beforeVat, vatAmount, totalAmount: round2(totalAmount), vatRate },
      paymentSummary: {
        totalAmount: round2(totalAmount),
        receivedAmount,
        balanceAmount,
        changeAmount,
        hasPayment: receivedAmount > 0,
        isFullyPaid: receivedAmount >= round2(totalAmount),
        isPartiallyPaid: receivedAmount > 0 && receivedAmount < round2(totalAmount),
      },
    };

    return res.json(response);
  } catch (error) {
    console.error('❌ [getSaleById] error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getSalesByBranchId = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    if (!branchId) return res.status(400).json({ error: 'branchId ไม่ถูกต้อง' });

    const sales = await prisma.sale.findMany({
      where: { branchId: Number(branchId) },
      orderBy: { soldAt: 'desc' },
      include: SALE_DOCUMENT_INCLUDE,
    });

    const mapped = sales.map((sale) => ({
      id: sale.id,
      code: sale.code,
      totalAmount: NORMALIZE_DECIMAL_TO_NUMBER ? toNum(sale.totalAmount) : sale.totalAmount,
      createdAt: sale.createdAt,
      customerName: sale.customer?.name || sale.customer?.companyName || '-',
      customerPhone: sale.customer?.user?.loginId || '-',
    }));

    return res.json(mapped);
  } catch (error) {
    console.error('❌ [getSalesByBranchId] Error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลใบเสร็จย้อนหลัง' });
  }
};

const searchPrintableSales = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const { keyword = '', fromDate, toDate, limit: limitRaw, onlyUnpaid, onlyPaid } = req.query;
    const onlyUnpaidBool = ['1', 'true', 'yes', 'y'].includes(String(onlyUnpaid ?? '').toLowerCase());
    const onlyPaidBool = ['1', 'true', 'yes', 'y'].includes(String(onlyPaid ?? '').toLowerCase());
    const bothFlags = onlyPaidBool && onlyUnpaidBool;

    const limitParsed = parseInt(limitRaw, 10);
    const take = Math.min(Math.max(Number.isFinite(limitParsed) ? limitParsed : 100, 1), 500);

    const fromRange = fromDate ? toLocalRange(String(fromDate)) : null;
    const toRange = toDate ? toLocalRange(String(toDate)) : null;

    const where = {
      branchId,
      status: { not: 'CANCELLED' },
      ...(keyword
        ? {
            OR: [
              { code: { contains: String(keyword), mode: 'insensitive' } },
              { note: { contains: String(keyword), mode: 'insensitive' } },
              { customer: { is: { name: { contains: String(keyword), mode: 'insensitive' } } } },
              { customer: { is: { companyName: { contains: String(keyword), mode: 'insensitive' } } } },
            ],
          }
        : {}),
      ...(fromRange || toRange
        ? {
            createdAt: {
              ...(fromRange ? { gte: fromRange.start } : {}),
              ...(toRange ? { lte: toRange.end } : {}),
            },
          }
        : {}),
    };

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: SALE_DOCUMENT_INCLUDE,
    });

    const saleIds = sales.map((s) => s.id);

    const payments = saleIds.length
      ? await prisma.payment.findMany({
          where: { saleId: { in: saleIds }, isCancelled: false },
          orderBy: { receivedAt: 'desc' },
          select: { saleId: true, receivedAt: true, items: { select: { amount: true } } },
        })
      : [];

    const paymentAgg = new Map();
    for (const p of payments) {
      const sid = p.saleId;
      const prev = paymentAgg.get(sid) || { paidAmount: 0, lastPaidAt: null };
      const itemSum = (Array.isArray(p.items) ? p.items : []).reduce((ss, it) => {
        const amt = it?.amount != null ? toNum(it.amount) : 0;
        return ss + amt;
      }, 0);

      const nextPaid = prev.paidAmount + itemSum;
      const nextLast = !prev.lastPaidAt
        ? p.receivedAt || null
        : p.receivedAt && new Date(p.receivedAt) > new Date(prev.lastPaidAt) ? p.receivedAt : prev.lastPaidAt;

      paymentAgg.set(sid, { paidAmount: nextPaid, lastPaidAt: nextLast });
    }

    const rowsAll = sales.map((s) => {
      const totalAmount = resolveCanonicalTotalAmount(s);
      const storedPaidAmount = s?.paidAmount != null ? toNum(s.paidAmount) : null;
      const agg = paymentAgg.get(s.id) || { paidAmount: 0, lastPaidAt: null };
      const aggPaid = agg.paidAmount || 0;
      const paidAmount = storedPaidAmount == null ? aggPaid : Math.max(storedPaidAmount, aggPaid);
      const balanceAmount = Math.max(0, round2(totalAmount - paidAmount));
      const paidEnough = totalAmount > 0 ? paidAmount >= totalAmount : false;
      const lastPaidAt = (storedPaidAmount != null ? null : agg.lastPaidAt) || null;

      return {
        id: s.id,
        code: s.code,
        createdAt: s.createdAt,
        soldAt: s.soldAt || null,
        totalAmount: round2(totalAmount),
        paidAmount: Number(paidAmount.toFixed(2)),
        balanceAmount,
        paid: !!(s.paid || paidEnough),
        hasPayment: paidAmount > 0,
        isFullyPaid: paidEnough,
        isPartiallyPaid: paidAmount > 0 && paidAmount < totalAmount,
        lastPaidAt,
        customerName: s.customer?.name || '-',
        companyName: s.customer?.companyName || '-',
        customerPhone: s.customer?.user?.loginId || '-',
        employeeName: s.employee?.name || '-',
        status: s.status,
        isCredit: !!s.isCredit,
      };
    });

    let rows = rowsAll;
    if (bothFlags) {
      rows = rows.filter((r) => (r?.paidAmount ?? 0) > 0 && (r?.balanceAmount ?? 0) > 0);
    } else {
      if (onlyUnpaidBool) rows = rows.filter((r) => (r?.balanceAmount ?? 0) > 0);
      if (onlyPaidBool) rows = rows.filter((r) => !!r?.isFullyPaid);
    }

    return res.json(rows);
  } catch (error) {
    console.error('❌ [searchPrintableSales] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดข้อมูลใบขายย้อนหลังได้' });
  }
};

const getAllSalesReturn = getAllSales;

module.exports = {
  getAllSales,
  getAllSalesReturn,
  getSaleById,
  getSalesByBranchId,
  searchPrintableSales,
};
