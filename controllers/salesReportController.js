




// salesReportController.js — Prisma singleton, Decimal-safe, BRANCH_SCOPE_ENFORCED

const { prisma, Prisma } = require('../lib/prisma');

// Helpers
const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v ?? 0));
const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v ?? 0));
const startOfDay = (d) => new Date(new Date(d).setHours(0, 0, 0, 0));
const endOfDay = (d) => new Date(new Date(d).setHours(23, 59, 59, 999));

const ALLOWED_SALES_SORT_FIELDS = new Set([
  'soldAt',
  'totalAmount',
  'itemCount',
  'averagePricePerItem',
]);

const ALLOWED_SALES_SORT_DIRECTIONS = new Set(['asc', 'desc']);
const ALLOWED_SALE_STATUS_FILTERS = new Set([
  'DRAFT',
  'DELIVERED',
  'FINALIZED',
  'COMPLETED',
  'CANCELLED',
]);
const SALE_STATUS_FILTER_ALIAS_MAP = {
  PENDING: 'DRAFT',
  VOID: 'CANCELLED',
};

const normalizeSaleStatusFilter = (value) => {
  const raw = normalizeText(value).toUpperCase();
  if (!raw || raw === 'ALL') return undefined;

  const mapped = SALE_STATUS_FILTER_ALIAS_MAP[raw] || raw;
  return ALLOWED_SALE_STATUS_FILTERS.has(mapped) ? mapped : undefined;
};

const normalizeSortField = (value) => {
  const field = normalizeText(value);
  return ALLOWED_SALES_SORT_FIELDS.has(field) ? field : 'soldAt';
};

const normalizeSortDirection = (value) => {
  const direction = String(value || '').toLowerCase();
  return ALLOWED_SALES_SORT_DIRECTIONS.has(direction) ? direction : 'desc';
};

const normalizeText = (v) => String(v ?? '').trim();
const toInt = (v, fallback = 0) => {
  const parsed = Number.parseInt(v, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const decimalToDateKey = (d) => {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const pickValue = (obj, keys = [], fallback = null) => {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return fallback;
};
const getSaleItemQty = (item) =>
  toNum(
    pickValue(item, ['quantity', 'qty', 'count', 'amount', 'units'], item?.stockItemId ? 1 : 0)
  );
const getSaleItemLineTotal = (item) =>
  toNum(pickValue(item, ['lineTotal', 'totalAmount', 'totalPrice', 'subtotal'], 0));
const getSaleItemUnitPrice = (item) =>
  toNum(pickValue(item, ['unitPrice', 'price', 'sellPrice'], 0));
const getSaleItemDiscount = (item) =>
  toNum(pickValue(item, ['discountAmount', 'discount', 'totalDiscount'], 0));
const getSaleItemName = (item) =>
  pickValue(item, ['productName', 'name'], '') ||
  item?.stockItem?.product?.name ||
  (item?.stockItem?.productId ? `Product #${item.stockItem.productId}` : '-');
const getSaleItemBarcode = (item) =>
  pickValue(item, ['barcode', 'serialNumber', 'productBarcode'], '') ||
  item?.stockItem?.barcode ||
  item?.stockItem?.serialNumber ||
  '';

const buildDateRange = (dateFrom, dateTo) => {
  const where = {};

  if (dateFrom) {
    const parsed = startOfDay(dateFrom);
    if (!Number.isNaN(parsed.getTime())) where.gte = parsed;
  }

  if (dateTo) {
    const parsed = endOfDay(dateTo);
    if (!Number.isNaN(parsed.getTime())) where.lte = parsed;
  }

  return Object.keys(where).length > 0 ? where : undefined;
};

const buildSalesWhere = ({ branchId, query = {} }) => {
  const keyword = normalizeText(query.q || query.keyword);
  const soldAt = buildDateRange(query.dateFrom || query.startDate, query.dateTo || query.endDate);
  const normalizedStatus = normalizeSaleStatusFilter(query.status);

  const where = {
    branchId,
    ...(soldAt ? { soldAt } : {}),
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
  };
  
  if (query.paymentMethod && query.paymentMethod !== 'ALL') {
    where.payments = {
      some: {
        items: {
          some: {
            paymentMethod: query.paymentMethod,
          },
        },
      },
    };
  }

  if (keyword) {
    where.OR = [
      { code: { contains: keyword, mode: 'insensitive' } },
      { taxInvoiceNumber: { contains: keyword, mode: 'insensitive' } },
    ];
  }

  return where;
};

const getSaleItemModel = () => (typeof prisma.saleItem?.findMany === 'function' ? prisma.saleItem : null);
const getSalePaymentModel = () =>
  typeof prisma.payment?.findMany === 'function' ? prisma.payment : null;
const getStockBalanceModel = () =>
  typeof prisma.stockBalance?.findMany === 'function' ? prisma.stockBalance : null;
const getPurchaseOrderModel = () =>
  typeof prisma.purchaseOrder?.count === 'function' ? prisma.purchaseOrder : null;

const getTopProductsFromSales = async ({ saleIds = [], branchId }) => {
  try {
    const saleItemModel = getSaleItemModel();
    if (!saleItemModel || saleIds.length === 0) return [];

    const saleItems = await saleItemModel.findMany({
      where: { saleId: { in: saleIds } },
      include: {
        stockItem: {
          include: {
            product: true,
          },
        },
      },
    });

    const productMap = new Map();

    for (const item of saleItems) {
      const productId =
        pickValue(item, ['productId'], null) || item?.stockItem?.productId || null;
      const productKey = productId || `${getSaleItemName(item)}-${getSaleItemBarcode(item) || 'NA'}`;
      const current = productMap.get(productKey) || {
        id: productId || productKey,
        productId: productId || null,
        name: getSaleItemName(item),
        qty: 0,
        sales: 0,
      };

      current.qty += getSaleItemQty(item);
      current.sales += getSaleItemLineTotal(item);
      productMap.set(productKey, current);
    }

    const rows = Array.from(productMap.values()).sort((a, b) => b.sales - a.sales);
    const productIds = rows.map((item) => item.productId).filter(Boolean);

    let balanceMap = new Map();
    const stockBalanceModel = getStockBalanceModel();
    if (stockBalanceModel && productIds.length > 0) {
      const balances = await stockBalanceModel.findMany({
        where: {
          branchId,
          productId: { in: productIds },
        },
      });

      balanceMap = new Map(
        balances.map((balance) => [
          balance.productId,
          Math.max(toNum(balance.quantity) - toNum(balance.reserved), 0),
        ])
      );
    }

    return rows.slice(0, 10).map((item, index, list) => {
      let trend = 'STABLE';
      if (index === 0 || item.sales > (list[index - 1]?.sales || 0) * 0.8) trend = 'UP';
      if (item.qty <= 1) trend = 'DOWN';

      return {
        id: item.id,
        name: item.name,
        qty: item.qty,
        sales: Number(item.sales.toFixed(2)),
        stockLeft: item.productId ? balanceMap.get(item.productId) || 0 : 0,
        trend,
      };
    });
  } catch (error) {
    console.error('❌ [getTopProductsFromSales] error:', error);
    return [];
  }
};

const getSalesDashboard = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) {
      return res.status(403).json({ message: 'ไม่พบสิทธิ์สาขาของผู้ใช้ (branchId)' });
    }

    const where = buildSalesWhere({ branchId, query: req.query || {} });
    const sales = await prisma.sale.findMany({
      where,
      orderBy: { soldAt: 'asc' },
      select: {
        id: true,
        soldAt: true,
        totalAmount: true,
        vat: true,
      },
    });

    const totalSales = sales.reduce((sum, sale) => sum + toNum(sale.totalAmount), 0);
    const totalBills = sales.length;
    const avgPerBill = totalBills > 0 ? totalSales / totalBills : 0;

    let totalUnits = 0;
    const saleItemModel = getSaleItemModel();
    if (saleItemModel && sales.length > 0) {
      const saleItems = await saleItemModel.findMany({
        where: { saleId: { in: sales.map((sale) => sale.id) } },
      });
      totalUnits = saleItems.reduce((sum, item) => sum + getSaleItemQty(item), 0);
    }

    const dailyMap = new Map();
    for (const sale of sales) {
      const key = decimalToDateKey(sale.soldAt);
      dailyMap.set(key, (dailyMap.get(key) || 0) + toNum(sale.totalAmount));
    }

    const dailySales = Array.from(dailyMap.entries()).map(([label, amount]) => ({
      label,
      amount: Number(amount.toFixed(2)),
    }));

    let pendingOrders = 0;
    const purchaseOrderModel = getPurchaseOrderModel();
    if (purchaseOrderModel) {
      pendingOrders = await purchaseOrderModel.count({
        where: {
          branchId,
          status: { in: ['PENDING', 'PARTIALLY_RECEIVED'] },
        },
      });
    }

    let growthPct = 0;
    const range = buildDateRange(req.query?.dateFrom, req.query?.dateTo);
    if (range?.gte && range?.lte) {
      const currentStart = range.gte;
      const currentEnd = range.lte;
      const spanMs = currentEnd.getTime() - currentStart.getTime() + 1;
      const previousStart = new Date(currentStart.getTime() - spanMs);
      const previousEnd = new Date(currentEnd.getTime() - spanMs);

      const previousAggregate = await prisma.sale.aggregate({
        where: {
          branchId,
          soldAt: { gte: previousStart, lte: previousEnd },
        },
        _sum: { totalAmount: true },
      });

      const previousTotal = toNum(previousAggregate?._sum?.totalAmount);
      if (previousTotal > 0) {
        growthPct = ((totalSales - previousTotal) / previousTotal) * 100;
      }
    }

    const topProducts = await getTopProductsFromSales({
      saleIds: sales.map((sale) => sale.id),
      branchId,
    });

    const risks = [];
    if (topProducts.some((item) => item.stockLeft > 0 && item.stockLeft <= 2)) {
      risks.push('มีสินค้าขายดีที่สต๊อกคงเหลือต่ำ ควรตรวจสอบและเตรียมสั่งซื้อ');
    }
    if (pendingOrders > 0) {
      risks.push(`มีใบสั่งซื้อค้างรับสินค้า ${pendingOrders} รายการ`);
    }
    if (totalBills === 0) {
      risks.push('ยังไม่พบรายการขายในช่วงเวลาที่เลือก');
    }

    return res.status(200).json({
      summary: {
        totalSales: Number(totalSales.toFixed(2)),
        totalBills,
        avgPerBill: Number(avgPerBill.toFixed(2)),
        totalUnits,
        pendingOrders,
        growthPct: Number(growthPct.toFixed(2)),
      },
      dailySales,
      topProducts,
      risks,
    });
  } catch (error) {
    console.error('❌ [getSalesDashboard] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึง dashboard รายงานการขายได้' });
  }
};

const getSalesList = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) {
      return res.status(403).json({ message: 'ไม่พบสิทธิ์สาขาของผู้ใช้ (branchId)' });
    }

    const page = Math.max(toInt(req.query?.page, 1), 1);
    const pageSize = Math.min(Math.max(toInt(req.query?.pageSize, 20), 1), 100);
    const skip = (page - 1) * pageSize;
    const sortBy = normalizeSortField(req.query?.sortBy);
    const sortDirection = normalizeSortDirection(req.query?.sortDirection);
    const where = buildSalesWhere({ branchId, query: req.query || {} });

    const dbSortableFields = new Set(['soldAt', 'totalAmount']);
    const dbOrderBy = dbSortableFields.has(sortBy)
      ? { [sortBy]: sortDirection }
      : { soldAt: 'desc' };

    const [total, summaryAggregate, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.aggregate({
        where,
        _sum: {
          totalAmount: true,
          totalDiscount: true,
          vat: true,
        },
        _count: { id: true },
      }),
      prisma.sale.findMany({
        where,
        orderBy: dbOrderBy,
        skip,
        take: pageSize,
        include: {
          customer: true,
          payments: {
            include: {
              items: true,
            },
            orderBy: { id: 'asc' },
          },
        },
      }),
    ]);

    const saleIds = sales.map((sale) => sale.id);
    let itemCountMap = new Map();
    const saleItemModel = getSaleItemModel();
    if (saleItemModel && saleIds.length > 0) {
      const saleItems = await saleItemModel.findMany({ where: { saleId: { in: saleIds } } });
      itemCountMap = saleItems.reduce((map, item) => {
        const current = map.get(item.saleId) || 0;
        const qty = getSaleItemQty(item);

        map.set(item.saleId, current + (qty > 0 ? qty : 1));
        return map;
      }, new Map());
    }

    let rows = sales.map((sale) => {
      const itemCount = itemCountMap.get(sale.id) || 0;
      const totalAmount = toNum(sale.totalAmount);

      return {
        id: sale.id,
        saleNo: sale.taxInvoiceNumber || sale.code || `SALE-${sale.id}`,
        soldAt: sale.soldAt,
        customerName: sale.customer?.name || 'ลูกค้าทั่วไป',
        employeeName: '-',
        paymentMethod:
          sale.payments?.flatMap((payment) => payment.items || [])?.[0]?.paymentMethod || 'CASH',
        status: sale.status || 'COMPLETED',
        itemCount,
        totalAmount,
        averagePricePerItem: itemCount > 0 ? Number((totalAmount / itemCount).toFixed(2)) : 0,
      };
    });

    // NOTE:
    // - DB-sort is authoritative for soldAt / totalAmount
    // - in-memory sort below is used only for computed fields on the hydrated page
    if (sortBy === 'itemCount' || sortBy === 'averagePricePerItem') {
      rows.sort((a, b) => {
        const directionFactor = sortDirection === 'asc' ? 1 : -1;

        if (sortBy === 'itemCount') {
          return (a.itemCount - b.itemCount) * directionFactor;
        }

        return (a.averagePricePerItem - b.averagePricePerItem) * directionFactor;
      });
    }

    const totalSales = toNum(summaryAggregate?._sum?.totalAmount);
    const totalBills = Number(summaryAggregate?._count?.id || 0);
    const avgPerBill = totalBills > 0 ? totalSales / totalBills : 0;

    return res.status(200).json({
      summary: {
        totalSales: Number(totalSales.toFixed(2)),
        totalBills,
        avgPerBill: Number(avgPerBill.toFixed(2)),
        totalDiscount: toNum(summaryAggregate?._sum?.totalDiscount),
        totalVat: toNum(summaryAggregate?._sum?.vat),
      },
      rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
      sorting: {
        sortBy,
        sortDirection,
      },
    });
  } catch (error) {
    console.error('❌ [getSalesList] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงรายการขายได้' });
  }
};

const getProductPerformance = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) {
      return res.status(403).json({ message: 'ไม่พบสิทธิ์สาขาของผู้ใช้ (branchId)' });
    }

    const where = buildSalesWhere({ branchId, query: req.query || {} });
    const sales = await prisma.sale.findMany({
      where,
      select: { id: true, totalAmount: true },
    });

    const topByRevenue = await getTopProductsFromSales({
      saleIds: sales.map((sale) => sale.id),
      branchId,
    });

    const totalProductsSold = topByRevenue.length;
    const totalUnitsSold = topByRevenue.reduce((sum, item) => sum + toNum(item.qty), 0);
    const totalSalesValue = topByRevenue.reduce((sum, item) => sum + toNum(item.sales), 0);
    const lowStockBestSellers = topByRevenue
      .filter((item) => item.stockLeft <= 2)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        name: item.name,
        soldQty: item.qty,
        stockLeft: item.stockLeft,
        reorderHint:
          item.stockLeft === 0
            ? 'สินค้าหมดแล้ว ควรรีบเติมสต๊อก'
            : 'เหลือน้อยกว่าระดับปลอดภัย',
      }));

    let slowMoving = [];
    const stockBalanceModel = getStockBalanceModel();
    if (stockBalanceModel) {
      const balances = await stockBalanceModel.findMany({
        where: {
          branchId,
          quantity: { gt: 0 },
        },
        include: {
          product: true,
        },
        take: 50,
      });

      const hotProductIds = new Set(topByRevenue.map((item) => item.productId).filter(Boolean));
      slowMoving = balances
        .filter((balance) => !hotProductIds.has(balance.productId))
        .slice(0, 10)
        .map((balance) => ({
          id: balance.productId || balance.id,
          name: balance.product?.name || `Product #${balance.productId}`,
          stockLeft: toNum(balance.quantity) - toNum(balance.reserved),
          lastSoldAt: null,
          daysWithoutSale: 0,
        }));
    }

    return res.status(200).json({
      summary: {
        totalProductsSold,
        totalUnitsSold,
        totalSalesValue: Number(totalSalesValue.toFixed(2)),
        lowStockHotProducts: lowStockBestSellers.length,
      },
      topByRevenue,
      slowMoving,
      lowStockBestSellers,
    });
  } catch (error) {
    console.error('❌ [getProductPerformance] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลวิเคราะห์สินค้าได้' });
  }
};

const getSalesDetail = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const saleId = Number(req.params?.saleId);

    if (!branchId) {
      return res.status(403).json({ message: 'ไม่พบสิทธิ์สาขาของผู้ใช้ (branchId)' });
    }
    if (!saleId) {
      return res.status(400).json({ message: 'กรุณาระบุ saleId' });
    }

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, branchId },
      include: {
        customer: true,
      },
    });

    if (!sale) {
      return res.status(404).json({ message: 'ไม่พบบิลขายที่ต้องการ' });
    }

    const saleItemModel = getSaleItemModel();
    const salePaymentModel = getSalePaymentModel();

    const [itemsRaw, paymentsRaw] = await Promise.all([
      saleItemModel
        ? saleItemModel.findMany({
          where: { saleId },
          include: {
            stockItem: {
              include: {
                product: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        })
        : Promise.resolve([]),
      salePaymentModel
        ? salePaymentModel.findMany({
          where: { saleId },
          include: {
            items: true,
          },
          orderBy: { id: 'asc' },
        })
        : Promise.resolve([]),
    ]);

    const items = itemsRaw.map((item) => ({
      id: item.id,
      productName: getSaleItemName(item),
      barcode: getSaleItemBarcode(item),
      qty: getSaleItemQty(item),
      unitPrice: getSaleItemUnitPrice(item),
      discountAmount: getSaleItemDiscount(item),
      lineTotal: getSaleItemLineTotal(item),
    }));

    const payments = paymentsRaw.map((payment) => {
      const firstItem = Array.isArray(payment.items) && payment.items.length > 0 ? payment.items[0] : null;
      const totalAmount = Array.isArray(payment.items)
        ? payment.items.reduce((sum, item) => sum + toNum(item.amount), 0)
        : 0;

      return {
        id: payment.id,
        method: firstItem?.paymentMethod || 'CASH',
        amount: totalAmount,
        paidAt: payment.receivedAt || payment.createdAt || null,
        reference: payment.code || '',
      };
    });

    const beforeVat = D(sale.totalAmount).minus(D(sale.vat));
    const timeline = [
      {
        id: 1,
        label: 'สร้างรายการขาย',
        at: sale.soldAt,
        by: '-',
      },
      ...payments.map((payment, index) => ({
        id: `payment-${payment.id}`,
        label: 'บันทึกการชำระเงิน',
        at: payment.paidAt,
        by: '-',
        sortIndex: index + 1,
      })),
    ];

    return res.status(200).json({
      sale: {
        id: sale.id,
        saleNo: sale.taxInvoiceNumber || sale.code || `SALE-${sale.id}`,
        soldAt: sale.soldAt,
        customerName: sale.customer?.name || 'ลูกค้าทั่วไป',
        customerPhone: sale.customer?.phone || '-',
        employeeName: '-',
        paymentMethod: payments[0]?.method || 'CASH',
        paymentStatus: sale.statusPayment || 'UNPAID',
        saleStatus: sale.status || 'COMPLETED',
        branchName: '-',
        note: sale.note || sale.remark || '',
        subtotal: toNum(sale.totalBeforeDiscount),
        discountAmount: toNum(sale.totalDiscount),
        beforeVat: toNum(beforeVat),
        vatAmount: toNum(sale.vat),
        totalAmount: toNum(sale.totalAmount),
        receivedAmount: toNum(sale.receivedAmount),
        changeAmount: toNum(sale.changeAmount),
      },
      items,
      payments,
      timeline,
    });
  } catch (error) {
    console.error('❌ [getSalesDetail] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงรายละเอียดบิลขายได้' });
  }
};

const getSalesTaxReport = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const { startDate, endDate } = req.query || {};

    if (!branchId) {
      return res.status(403).json({ message: 'ไม่พบสิทธิ์สาขาของผู้ใช้ (branchId)' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'กรุณาระบุช่วงวันที่ (startDate, endDate)' });
    }

    const parsedStart = startOfDay(startDate);
    const parsedEnd = endOfDay(endDate);

    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ message: 'วันที่ไม่ถูกต้อง' });
    }

    console.log('📌 [getSalesTaxReport]', { branchId, parsedStart, parsedEnd });

    // ✅ ดึงเฉพาะใบกำกับภาษีขายของสาขานี้
    const sales = await prisma.sale.findMany({
      where: {
        branchId,
        isTaxInvoice: true,
        soldAt: { gte: parsedStart, lte: parsedEnd },
      },
      orderBy: { soldAt: 'asc' },
      include: { customer: true },
    });

    // ✅ ดึงใบคืนที่อ้างอิงใบกำกับภาษีขาย (ในช่วงเวลาเดียวกัน)
    const returns = await prisma.saleReturn.findMany({
      where: {
        returnedAt: { gte: parsedStart, lte: parsedEnd },
        sale: { branchId, isTaxInvoice: true },
      },
      orderBy: { returnedAt: 'asc' },
      include: { sale: { include: { customer: true } } },
    });

    const saleResults = sales.map((sale) => {
      // หมายเหตุ: baseAmount ยังคงตรรกะเดิมของระบบ (beforeDiscount + discount)
      const baseAmountDec = D(sale.totalBeforeDiscount).plus(D(sale.totalDiscount));
      const vatAmountDec = D(sale.vat);
      const totalAmountDec = D(sale.totalAmount);

      return {
        date: sale.soldAt,
        taxInvoiceNumber: sale.taxInvoiceNumber || sale.code,
        customerName: sale.customer?.name || '-',
        taxId: sale.customer?.taxId || '',
        baseAmount: toNum(baseAmountDec),
        vatAmount: toNum(vatAmountDec),
        totalAmount: toNum(totalAmountDec),
        type: 'sale',
      };
    });

    const returnResults = returns.map((ret) => {
      const baseAmountDec = D(ret.totalBeforeDiscount).plus(D(ret.totalDiscount));
      const vatAmountDec = D(ret.vat);
      const totalAmountDec = D(ret.totalAmount);

      return {
        date: ret.returnedAt,
        taxInvoiceNumber: ret.taxInvoiceNumber || ret.code,
        customerName: ret.sale?.customer?.name || '-',
        taxId: ret.sale?.customer?.taxId || '',
        baseAmount: toNum(baseAmountDec),
        vatAmount: toNum(vatAmountDec),
        totalAmount: toNum(totalAmountDec),
        type: 'return',
      };
    });

    return res.status(200).json({ sales: saleResults, returns: returnResults, period: { start: parsedStart, end: parsedEnd } });
  } catch (error) {
    console.error('❌ [getSalesTaxReport] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงรายงานภาษีขายได้' });
  }
};

module.exports = {
  getSalesDashboard,
  getSalesList,
  getProductPerformance,
  getSalesDetail,
  getSalesTaxReport,
};








