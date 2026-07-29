







// ============================================================
// 📁 FILE: server/controllers/financeController.js
// ============================================================

// ✅ ตามมาตรฐาน: import prisma จาก lib/prisma เท่านั้น
const prismaImport = require('../lib/prisma');
const prisma = prismaImport?.prisma || prismaImport;

// ------------------------------
// helpers (defensive)
// ------------------------------
const safeInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const safeDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const safeStr = (v) => {
  if (v == null) return '';
  return String(v).trim();
};

const money = (v) => {
  // Prisma Decimal may come as string, number, or Decimal.js instance
  // - Decimal.js: has toNumber() and toString()
  // - Some drivers return string
  if (v == null) return 0;

  try {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }

    // Decimal.js (Prisma)
    if (typeof v?.toNumber === 'function') {
      const n = v.toNumber();
      return Number.isFinite(n) ? n : 0;
    }

    // Fallback: try toString()
    if (typeof v?.toString === 'function') {
      const n = Number(v.toString());
      return Number.isFinite(n) ? n : 0;
    }

    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch (_e) {
    return 0;
  }
};

const getBranchIdOr401 = (req, res) => {
  const branchId = safeInt(req?.user?.branchId);
  if (!branchId) {
    res.status(401).json({ message: 'unauthorized' });
    return null;
  }
  return branchId;
};

// FE ส่ง status=OPEN เป็นหลัก (ลูกหนี้/ยอดค้าง)
const mapArStatus = (statusParam) => {
  const s = safeStr(statusParam).toUpperCase();
  if (!s || s === 'OPEN') return ['UNPAID', 'PARTIALLY_PAID', 'WAITING_APPROVAL'];
  if (s === 'UNPAID') return ['UNPAID'];
  if (s === 'PARTIALLY_PAID') return ['PARTIALLY_PAID'];
  if (s === 'WAITING_APPROVAL') return ['WAITING_APPROVAL'];
  if (s === 'PAID') return ['PAID'];
  if (s === 'CANCELLED') return ['CANCELLED'];
  if (s === 'ALL') return ['UNPAID', 'PARTIALLY_PAID', 'WAITING_APPROVAL', 'PAID', 'CANCELLED'];
  // fallback
  return ['UNPAID', 'PARTIALLY_PAID', 'WAITING_APPROVAL'];
};

const buildArWhere = ({ branchId, fromDate, toDate, statuses, keyword }) => {
  const where = {
    branchId,
    statusPayment: { in: statuses },
  };

  // soldAt range (inclusive)
  if (fromDate || toDate) {
    where.soldAt = {};
    if (fromDate) where.soldAt.gte = fromDate;
    if (toDate) {
      // inclusive end-of-day
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      where.soldAt.lte = end;
    }
  }

  // NOTE: keyword logic is handled by buildArWhereAsync to avoid hard-coding Sale.customer relation name
  const q = safeStr(keyword);
  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { refCode: { contains: q, mode: 'insensitive' } },
      { officialDocumentNumber: { contains: q, mode: 'insensitive' } },
    ];
  }

  return where;
};

// ✅ keyword-aware where (2-step): search customerProfile first → apply customerId IN (...) to Sale
const buildArWhereAsync = async ({ branchId, fromDate, toDate, statuses, keyword }) => {
  const where = buildArWhere({ branchId, fromDate, toDate, statuses, keyword });

  const q = safeStr(keyword);
  if (!q) return where;

  // Defensive: customer model may not exist in some schema variations
  const hasCustomerModel = !!prisma?.customerProfile?.findMany;
  if (!hasCustomerModel) return where;

  // NOTE (Schema): CustomerProfile is global (no branchId field)
  // - We still enforce branch scope at Sale.branchId
  // - This lookup is only to support keyword search by customer fields
  let ids = [];
  try {
    const customers = await prisma.customerProfile.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { companyName: { contains: q, mode: 'insensitive' } },
          { taxId: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take: 2000,
    });

    ids = (customers || []).map((c) => c.id).filter(Boolean);
  } catch (_e) {
    ids = [];
  }

  if (ids.length) {
    where.OR = [...(where.OR || []), { customerId: { in: ids } }];
  }

  return where;
};

// ------------------------------
// Controllers
// ------------------------------

const pingFinance = async (req, res) => {
  try {
    const branchId = getBranchIdOr401(req, res);
    if (!branchId) return;

    return res.json({ success: true, module: 'finance', branchId });
  } catch (_err) {
    return res.status(500).json({ message: 'internal_error' });
  }
};

// --------------------------------------------------
// GET /api/finance/ar/summary?fromDate&toDate&status&keyword
// Accounts Receivable Summary (Branch scoped)
// --------------------------------------------------

const getAccountsReceivableSummary = async (req, res) => {
  try {
    const branchId = getBranchIdOr401(req, res);
    if (!branchId) return;

    const fromDate = safeDate(req.query.fromDate);
    const toDate = safeDate(req.query.toDate);
    const statuses = mapArStatus(req.query.status);
    const keyword = safeStr(req.query.keyword || req.query.searchText || req.query.q);

    const where = await buildArWhereAsync({ branchId, fromDate, toDate, statuses, keyword });

    const [agg, customersAgg] = await Promise.all([
      prisma.sale.aggregate({
        where,
        _sum: { totalAmount: true, paidAmount: true },
        _count: { _all: true },
      }),
      prisma.sale.groupBy({
        by: ['customerId'],
        where: {
          ...where,
          customerId: { not: null },
        },
      }),
    ]);

    const totalAmount = money(agg?._sum?.totalAmount);
    const paidAmount = money(agg?._sum?.paidAmount);
    const outstandingAmount = Math.max(0, totalAmount - paidAmount);

    const customerCount = Array.isArray(customersAgg)
      ? customersAgg.map((x) => x.customerId).filter(Boolean).length
      : 0;

    return res.json({
      success: true,
      summary: {
        totalBills: Number(agg?._count?._all ?? 0),
        totalOutstanding: outstandingAmount,
        totalCustomers: customerCount,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'internal_error', detail: String(err?.message || err) });
  }
};



// GET /api/finance/ar?fromDate&toDate&status&keyword&page&pageSize
const getAccountsReceivableRows = async (req, res) => {
  try {
    const branchId = getBranchIdOr401(req, res);
    if (!branchId) return;

    const fromDate = safeDate(req.query.fromDate);
    const toDate = safeDate(req.query.toDate);
    const statuses = mapArStatus(req.query.status);
    const keyword = safeStr(req.query.keyword || req.query.searchText || req.query.q);

    const page = Math.max(1, safeInt(req.query.page) || 1);
    const pageSizeRaw = safeInt(req.query.pageSize);
    const pageSize = Math.min(500, Math.max(10, pageSizeRaw || 200));
    const skip = (page - 1) * pageSize;

    const where = await buildArWhereAsync({ branchId, fromDate, toDate, statuses, keyword });

    const [rows, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        orderBy: [{ soldAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
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

    // ✅ Customer lookup (defensive): avoid hard-coding relation name "customer" in Sale model
    const customerIds = Array.from(new Set((rows || []).map((r) => r.customerId).filter(Boolean)));
    let customerMap = new Map();

    try {
      if (customerIds.length && prisma.customerProfile?.findMany) {
        const customers = await prisma.customerProfile.findMany({
          // NOTE (Schema): CustomerProfile is global (no branchId field)
          // Branch scope is enforced at Sale.branchId already
          where: { id: { in: customerIds } },
          select: { id: true, name: true, companyName: true, taxId: true },
        });
        customerMap = new Map((customers || []).map((c) => [c.id, c]));
      }
    } catch (_e) {
      // ignore lookup failures; rows will still render without customer object
    }

    const mapped = (rows || []).map((r) => {
      const totalAmount = money(r.totalAmount);
      const paidAmount = money(r.paidAmount);
      const outstanding = Math.max(0, totalAmount - paidAmount);
      const customerObj = (r.customerId ? customerMap.get(r.customerId) : null) || null;
      const customerName = safeStr(customerObj?.companyName) || safeStr(customerObj?.name) || '';

      return {
        id: r.id,
        saleId: r.id,
        code: r.code,
        saleCode: r.code, // ✅ alias เพื่อให้ FE ชัดสุด
        soldAt: r.soldAt,
        dueDate: r.dueDate,
        statusPayment: r.statusPayment,
        totalAmount,
        paidAmount,
        outstandingAmount: outstanding,
        customerId: r.customerId,
        customerName,
        customer: customerObj,
        refCode: r.refCode || null,
        officialDocumentNumber: r.officialDocumentNumber || null,
      };
    });

    return res.json({
      success: true,
      page,
      pageSize,
      total,
      rows: mapped,
    });
  } catch (err) {
    return res.status(500).json({ message: 'internal_error', detail: String(err?.message || err) });
  }
};

// Customer credit summary = credit exposure across customers in this branch
// NOTE (Schema): CustomerProfile is GLOBAL (no branchId). Branch scope is enforced via Sale.branchId.
// GET /api/finance/customer-credit/summary?fromDate&toDate&keyword
const getCustomerCreditSummary = async (req, res) => {
  try {
    const branchId = getBranchIdOr401(req, res);
    if (!branchId) return;

    const fromDate = safeDate(req.query.fromDate);
    const toDate = safeDate(req.query.toDate);
    const keyword = safeStr(req.query.keyword || req.query.searchText || req.query.q);

    const openStatuses = ['UNPAID', 'PARTIALLY_PAID', 'WAITING_APPROVAL'];

    // Base where (branch scoped + open only)
    const where = {
      branchId,
      customerId: { not: null },
      statusPayment: { in: openStatuses },
    };

    // soldAt range (inclusive end-of-day)
    if (fromDate || toDate) {
      where.soldAt = {};
      if (fromDate) where.soldAt.gte = fromDate;
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        where.soldAt.lte = end;
      }
    }

    // Optional keyword: filter by customer fields (best-effort)
    // - If keyword doesn't match any customer, return empty (so UI reflects filter intent)
    if (keyword && prisma.customerProfile?.findMany) {
      try {
        const matched = await prisma.customerProfile.findMany({
          where: {
            OR: [
              { name: { contains: keyword, mode: 'insensitive' } },
              { companyName: { contains: keyword, mode: 'insensitive' } },
              { taxId: { contains: keyword, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
          take: 5000,
        });

        const ids = (matched || []).map((m) => m.id).filter(Boolean);
        if (!ids.length) {
          return res.json({
            success: true,
            summary: {
              totalOutstanding: 0,
              totalCreditLimit: 0,
              totalRemainingLimit: 0,
              customerCount: 0,
            },
          });
        }

        where.customerId = { in: ids };
      } catch (_e) {
        // ignore keyword filter failure
      }
    }

    // ✅ Preferred: DB groupBy per customer (more scalable than loading all rows)
    // Fallback to findMany aggregation if groupBy fails in some environments.
    let grouped = [];
    try {
      grouped = await prisma.sale.groupBy({
        by: ['customerId'],
        where,
        _sum: { totalAmount: true, paidAmount: true },
      });
    } catch (_e) {
      // fallback
      const sales = await prisma.sale.findMany({
        where,
        select: { customerId: true, totalAmount: true, paidAmount: true },
        take: 500000, // defensive upper bound
      });

      const tmp = new Map();
      for (const s of sales || []) {
        const cid = s?.customerId;
        if (!cid) continue;
        const totalAmount = money(s.totalAmount);
        const paidAmount = money(s.paidAmount);
        const out = Math.max(0, totalAmount - paidAmount);
        tmp.set(cid, (tmp.get(cid) || 0) + out);
      }

      grouped = Array.from(tmp.entries()).map(([customerId, outstanding]) => ({
        customerId,
        _sum: { totalAmount: outstanding, paidAmount: 0 },
        __fallbackOutstanding: outstanding,
      }));
    }

    const customerIds = (grouped || []).map((g) => g.customerId).filter(Boolean);

    // Sum outstanding (computed per customer)
    let totalOutstanding = 0;
    const outstandingMap = new Map();

    for (const g of grouped || []) {
      const cid = g?.customerId;
      if (!cid) continue;

      // If fallback used, __fallbackOutstanding is already outstanding
      const fallbackOut = money(g?.__fallbackOutstanding);
      if (fallbackOut) {
        outstandingMap.set(cid, fallbackOut);
        totalOutstanding += fallbackOut;
        continue;
      }

      const totalAmount = money(g?._sum?.totalAmount);
      const paidAmount = money(g?._sum?.paidAmount);
      const out = Math.max(0, totalAmount - paidAmount);
      outstandingMap.set(cid, out);
      totalOutstanding += out;
    }

    // Best-effort: sum credit limits for the customers involved
    let totalCreditLimit = 0;
    try {
      if (customerIds.length && prisma.customerProfile?.findMany) {
        const customers = await prisma.customerProfile.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, creditLimit: true },
        });
        for (const c of customers || []) totalCreditLimit += money(c?.creditLimit);
      }
    } catch (_e) {
      // ignore
    }

    const totalRemainingLimit = Math.max(0, totalCreditLimit - totalOutstanding);

    return res.json({
      success: true,
      summary: {
        totalOutstanding,
        totalCreditLimit,
        totalRemainingLimit,
        customerCount: customerIds.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'internal_error', detail: String(err?.message || err) });
  }
};

// GET /api/finance/customer-credit?keyword&fromDate&toDate&page&pageSize
// NOTE (Schema): CustomerProfile is GLOBAL (no branchId). Branch scope is enforced via Sale.branchId.
const getCustomerCreditRows = async (req, res) => {
  try {
    const branchId = getBranchIdOr401(req, res);
    if (!branchId) return;

    const q = safeStr(req.query.keyword || req.query.searchText || req.query.q);
    const fromDate = safeDate(req.query.fromDate);
    const toDate = safeDate(req.query.toDate);

    const page = Math.max(1, safeInt(req.query.page) || 1);
    const pageSizeRaw = safeInt(req.query.pageSize);
    const pageSize = Math.min(500, Math.max(10, pageSizeRaw || 200));
    const skip = (page - 1) * pageSize;

    const openStatuses = ['UNPAID', 'PARTIALLY_PAID', 'WAITING_APPROVAL'];

    // Base where for OPEN credit sales (branch scoped)
    const saleWhere = {
      branchId,
      customerId: { not: null },
      statusPayment: { in: openStatuses },
    };

    // soldAt range (inclusive end-of-day)
    if (fromDate || toDate) {
      saleWhere.soldAt = {};
      if (fromDate) saleWhere.soldAt.gte = fromDate;
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        saleWhere.soldAt.lte = end;
      }
    }

    // Optional keyword filter by customer fields (best-effort)
    // - If keyword doesn't match any customer, return empty (so UI reflects filter intent)
    if (q && prisma.customerProfile?.findMany) {
      try {
        const matched = await prisma.customerProfile.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { companyName: { contains: q, mode: 'insensitive' } },
              { taxId: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
          take: 5000,
        });

        const ids = (matched || []).map((m) => m.id).filter(Boolean);
        if (!ids.length) {
          return res.json({ success: true, page, pageSize, total: 0, rows: [] });
        }

        saleWhere.customerId = { in: ids };
      } catch (_e) {
        // ignore keyword filter failure
      }
    }

    // ✅ Preferred: groupBy per customer in DB (scalable)
    // Fallback to findMany aggregation if groupBy fails.
    let grouped = [];
    try {
      grouped = await prisma.sale.groupBy({
        by: ['customerId'],
        where: saleWhere,
        _sum: { totalAmount: true, paidAmount: true },
      });
    } catch (_e) {
      const sales = await prisma.sale.findMany({
        where: saleWhere,
        select: { customerId: true, totalAmount: true, paidAmount: true },
        take: 500000,
      });

      const tmp = new Map();
      for (const s of sales || []) {
        const cid = s?.customerId;
        if (!cid) continue;
        const totalAmount = money(s.totalAmount);
        const paidAmount = money(s.paidAmount);
        const out = Math.max(0, totalAmount - paidAmount);
        tmp.set(cid, (tmp.get(cid) || 0) + out);
      }

      grouped = Array.from(tmp.entries()).map(([customerId, outstanding]) => ({
        customerId,
        _sum: { totalAmount: outstanding, paidAmount: 0 },
        __fallbackOutstanding: outstanding,
      }));
    }

    const outstandingMap = new Map();
    for (const g of grouped || []) {
      const cid = g?.customerId;
      if (!cid) continue;

      const fallbackOut = money(g?.__fallbackOutstanding);
      if (fallbackOut) {
        outstandingMap.set(cid, fallbackOut);
        continue;
      }

      const totalAmount = money(g?._sum?.totalAmount);
      const paidAmount = money(g?._sum?.paidAmount);
      const out = Math.max(0, totalAmount - paidAmount);
      outstandingMap.set(cid, out);
    }

    const idsAll = Array.from(outstandingMap.keys());

    if (!idsAll.length) {
      return res.json({ success: true, page, pageSize, total: 0, rows: [] });
    }

    const total = idsAll.length;

    // Sort by outstanding desc before paging
    const orderedIds = idsAll
      .map((id) => ({ id, outstanding: outstandingMap.get(id) || 0 }))
      .sort((a, b) => b.outstanding - a.outstanding || a.id - b.id)
      .map((x) => x.id);

    const pageIds = orderedIds.slice(skip, skip + pageSize);

    // Fetch customer info (best-effort)
    let customers = [];
    if (pageIds.length && prisma.customerProfile?.findMany) {
      try {
        customers = await prisma.customerProfile.findMany({
          where: { id: { in: pageIds } },
          select: {
            id: true,
            name: true,
            companyName: true,
            taxId: true,
            creditLimit: true,
            creditBalance: true,
            paymentTerms: true,
            updatedAt: true,
          },
        });
      } catch (_e) {
        customers = [];
      }
    }

    const customerMap = new Map((customers || []).map((c) => [c.id, c]));

    const rows = pageIds.map((customerId) => {
      const c = customerMap.get(customerId) || null;
      const creditLimit = money(c?.creditLimit);
      const outstandingCredit = outstandingMap.get(customerId) || 0;
      const remainingLimit = Math.max(0, creditLimit - outstandingCredit);
      const percentUsed = creditLimit > 0 ? Math.min(100, Math.round((outstandingCredit / creditLimit) * 100)) : 0;
      const displayName = safeStr(c?.companyName) || safeStr(c?.name) || '';

      return {
        id: customerId,
        customerId,
        customerName: displayName,
        name: c?.name || null,
        companyName: c?.companyName || null,
        taxId: c?.taxId || null,
        creditLimit,
        outstandingCredit,
        remainingLimit,
        percentUsed,
        // keep compatibility fields
        creditBalance: money(c?.creditBalance),
        paymentTerms: c?.paymentTerms ?? 0,
        updatedAt: c?.updatedAt || null,
      };
    });

    return res.json({
      success: true,
      page,
      pageSize,
      total,
      rows,
    });
  } catch (err) {
    return res.status(500).json({ message: 'internal_error', detail: String(err?.message || err) });
  }
};

// GET /api/finance/customer-credit/:customerId
// NOTE (Schema): CustomerProfile is GLOBAL (no branchId). Branch scope is enforced via Sale.branchId.
const getCustomerCreditByCustomerId = async (req, res) => {
  try {
    const branchId = getBranchIdOr401(req, res);
    if (!branchId) return;

    const customerId = safeInt(req.params.customerId);
    if (!customerId) {
      return res.status(400).json({ message: 'invalid_customerId' });
    }

    // Fetch customer (global)
    const customer = prisma.customerProfile?.findUnique
      ? await prisma.customerProfile.findUnique({
          where: { id: customerId },
          select: {
            id: true,
            name: true,
            companyName: true,
            taxId: true,
            creditLimit: true,
            creditBalance: true,
            paymentTerms: true,
          },
        })
      : null;

    if (!customer) {
      return res.status(404).json({ message: 'customer_not_found' });
    }

    // Enforce branch scope: customer must have at least one sale in this branch
    const hasAny = await prisma.sale.count({ where: { branchId, customerId } });
    if (!hasAny) {
      return res.status(404).json({ message: 'customer_not_in_branch' });
    }

    const openStatuses = ['UNPAID', 'PARTIALLY_PAID', 'WAITING_APPROVAL'];

    const agg = await prisma.sale.aggregate({
      where: {
        branchId,
        customerId,
        statusPayment: { in: openStatuses },
      },
      _sum: { totalAmount: true, paidAmount: true },
      _count: { _all: true },
    });

    const totalAmount = money(agg?._sum?.totalAmount);
    const paidAmount = money(agg?._sum?.paidAmount);
    const outstandingCredit = Math.max(0, totalAmount - paidAmount);

    const creditLimit = money(customer.creditLimit);
    const remainingLimit = Math.max(0, creditLimit - outstandingCredit);
    const percentUsed = creditLimit > 0 ? Math.min(100, Math.round((outstandingCredit / creditLimit) * 100)) : 0;

    return res.json({
      success: true,
      customer: {
        id: customer.id,
        customerId: customer.id,
        customerName: safeStr(customer.companyName) || safeStr(customer.name) || '',
        name: customer.name || null,
        companyName: customer.companyName || null,
        taxId: customer.taxId || null,
        creditLimit,
        creditBalance: money(customer.creditBalance),
        paymentTerms: customer.paymentTerms ?? 0,
      },
      summary: {
        invoiceCount: Number(agg?._count?._all ?? 0),
        outstandingCredit,
        remainingLimit,
        percentUsed,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'internal_error', detail: String(err?.message || err) });
  }
};

module.exports = {
  pingFinance,
  getAccountsReceivableSummary,
  getAccountsReceivableRows,
  getCustomerCreditSummary,
  getCustomerCreditRows,
  getCustomerCreditByCustomerId,
};














