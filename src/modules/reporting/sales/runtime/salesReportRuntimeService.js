const repository = require('./salesReportRuntimeRepository');

const D = repository.D;
const toNum = repository.toNum;

const startOfDay = (d) => new Date(new Date(d).setHours(0, 0, 0, 0));
const endOfDay = (d) => new Date(new Date(d).setHours(23, 59, 59, 999));
const normalizeText = (v) => String(v ?? '').trim();
const toInt = (v, fallback = 0) => {
  const parsed = Number.parseInt(v, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const pickValue = (obj, keys = [], fallback = null) => {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return fallback;
};
const decimalToDateKey = (d) => {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ALLOWED_SALES_SORT_FIELDS = new Set(['soldAt', 'totalAmount', 'itemCount', 'averagePricePerItem']);
const ALLOWED_SALES_SORT_DIRECTIONS = new Set(['asc', 'desc']);
const ALLOWED_SALE_STATUS_FILTERS = new Set(['DRAFT', 'DELIVERED', 'FINALIZED', 'COMPLETED', 'CANCELLED']);
const SALE_STATUS_FILTER_ALIAS_MAP = { PENDING: 'DRAFT', VOID: 'CANCELLED' };

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
  const where = { branchId, ...(soldAt ? { soldAt } : {}), ...(normalizedStatus ? { status: normalizedStatus } : {}) };
  if (query.paymentMethod && query.paymentMethod !== 'ALL') {
    where.payments = { some: { items: { some: { paymentMethod: query.paymentMethod } } } };
  }
  if (keyword) {
    where.OR = [
      { code: { contains: keyword, mode: 'insensitive' } },
      { customer: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
      { employee: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
    ];
  }
  return where;
};

const getSaleItemQty = (item) => toNum(pickValue(item, ['quantity', 'qty', 'count', 'amount', 'units'], item?.stockItemId ? 1 : 0));
const getSaleItemLineTotal = (item) => toNum(pickValue(item, ['lineTotal', 'totalAmount', 'totalPrice', 'subtotal'], 0));
const getSaleItemUnitPrice = (item) => toNum(pickValue(item, ['unitPrice', 'price', 'sellPrice'], 0));
const getSaleItemDiscount = (item) => toNum(pickValue(item, ['discountAmount', 'discount', 'totalDiscount'], 0));
const getSaleItemName = (item) => pickValue(item, ['productName', 'name'], '') || item?.stockItem?.product?.name || (item?.stockItem?.productId ? `Product #${item.stockItem.productId}` : '-');
const getSaleItemBarcode = (item) => pickValue(item, ['barcode', 'serialNumber', 'productBarcode'], '') || item?.stockItem?.barcode || item?.stockItem?.serialNumber || '';

const getTopProductsFromSales = async ({ saleIds = [], branchId }) => {
  try {
    const saleItems = await repository.findSaleItemsForTopProducts(saleIds);
    const productMap = new Map();
    for (const item of saleItems) {
      const productId = pickValue(item, ['productId'], null) || item?.stockItem?.productId || null;
      const productKey = productId || `${getSaleItemName(item)}-${getSaleItemBarcode(item) || 'NA'}`;
      const current = productMap.get(productKey) || { id: productId || productKey, productId: productId || null, name: getSaleItemName(item), qty: 0, sales: 0 };
      current.qty += getSaleItemQty(item);
      current.sales += getSaleItemLineTotal(item);
      productMap.set(productKey, current);
    }
    const rows = Array.from(productMap.values()).sort((a, b) => b.sales - a.sales);
    const balanceMap = await repository.getStockBalanceMap(branchId, rows.map((item) => item.productId).filter(Boolean));
    return rows.slice(0, 10).map((item, index, list) => {
      let trend = 'STABLE';
      if (index === 0 || item.sales > (list[index - 1]?.sales || 0) * 0.8) trend = 'UP';
      if (item.qty <= 1) trend = 'DOWN';
      return { id: item.id, name: item.name, qty: item.qty, sales: Number(item.sales.toFixed(2)), stockLeft: item.productId ? balanceMap.get(item.productId) || 0 : 0, trend };
    });
  } catch (error) {
    console.error('❌ [getTopProductsFromSales] error:', error);
    return [];
  }
};

const getSalesDashboard = async ({ branchId, query }) => {
  const where = buildSalesWhere({ branchId, query });
  const sales = await repository.findDashboardSales(where);
  const totalSales = sales.reduce((sum, sale) => sum + toNum(sale.totalAmount), 0);
  const totalBills = sales.length;
  const avgPerBill = totalBills > 0 ? totalSales / totalBills : 0;
  const saleItems = await repository.findSaleItemsBySaleIds(sales.map((sale) => sale.id));
  const totalUnits = saleItems.reduce((sum, item) => sum + getSaleItemQty(item), 0);
  const dailyMap = new Map();
  for (const sale of sales) {
    const key = decimalToDateKey(sale.soldAt);
    dailyMap.set(key, (dailyMap.get(key) || 0) + toNum(sale.totalAmount));
  }
  const dailySales = Array.from(dailyMap.entries()).map(([label, amount]) => ({ label, amount: Number(amount.toFixed(2)) }));
  const pendingOrders = await repository.countPendingPurchaseOrders(branchId);
  let growthPct = 0;
  const range = buildDateRange(query?.dateFrom, query?.dateTo);
  if (range?.gte && range?.lte) {
    const spanMs = range.lte.getTime() - range.gte.getTime() + 1;
    const previousTotal = await repository.sumSales(branchId, new Date(range.gte.getTime() - spanMs), new Date(range.lte.getTime() - spanMs));
    if (previousTotal > 0) growthPct = ((totalSales - previousTotal) / previousTotal) * 100;
  }
  const topProducts = await getTopProductsFromSales({ saleIds: sales.map((sale) => sale.id), branchId });
  const risks = [];
  if (topProducts.some((item) => item.stockLeft > 0 && item.stockLeft <= 2)) risks.push('มีสินค้าขายดีที่สต๊อกคงเหลือต่ำ ควรตรวจสอบและเตรียมสั่งซื้อ');
  if (pendingOrders > 0) risks.push(`มีใบสั่งซื้อค้างรับสินค้า ${pendingOrders} รายการ`);
  if (totalBills === 0) risks.push('ยังไม่พบรายการขายในช่วงเวลาที่เลือก');
  return { summary: { totalSales: Number(totalSales.toFixed(2)), totalBills, avgPerBill: Number(avgPerBill.toFixed(2)), totalUnits, pendingOrders, growthPct: Number(growthPct.toFixed(2)) }, dailySales, topProducts, risks };
};

const getSalesList = async ({ branchId, query }) => {
  const page = Math.max(toInt(query?.page, 1), 1);
  const pageSize = Math.min(Math.max(toInt(query?.pageSize, 20), 1), 100);
  const sortBy = normalizeSortField(query?.sortBy);
  const sortDirection = normalizeSortDirection(query?.sortDirection);
  const where = buildSalesWhere({ branchId, query });
  const dbOrderBy = new Set(['soldAt', 'totalAmount']).has(sortBy) ? { [sortBy]: sortDirection } : { soldAt: 'desc' };
  const { total, summaryAggregate, sales } = await repository.findSalesList({ where, orderBy: dbOrderBy, skip: (page - 1) * pageSize, take: pageSize });
  const saleItems = await repository.findSaleItemsBySaleIds(sales.map((sale) => sale.id));
  const itemCountMap = saleItems.reduce((map, item) => {
    const qty = getSaleItemQty(item);
    map.set(item.saleId, (map.get(item.saleId) || 0) + (qty > 0 ? qty : 1));
    return map;
  }, new Map());
  let rows = sales.map((sale) => {
    const itemCount = itemCountMap.get(sale.id) || 0;
    const totalAmount = toNum(sale.totalAmount);
    return {
      id: sale.id,
      saleNo: sale.taxInvoiceNumber || sale.code || `SALE-${sale.id}`,
      soldAt: sale.soldAt,
      customerName: sale.customer?.name || 'ลูกค้าทั่วไป',
      employeeName: sale.employee?.name || '-',
      paymentMethod: sale.payments?.flatMap((payment) => payment.items || [])?.[0]?.paymentMethod || 'CASH',
      status: sale.status || 'COMPLETED',
      itemCount,
      totalAmount,
      averagePricePerItem: itemCount > 0 ? Number((totalAmount / itemCount).toFixed(2)) : 0,
    };
  });
  if (sortBy === 'itemCount' || sortBy === 'averagePricePerItem') {
    rows.sort((a, b) => ((sortBy === 'itemCount' ? a.itemCount - b.itemCount : a.averagePricePerItem - b.averagePricePerItem) * (sortDirection === 'asc' ? 1 : -1)));
  }
  const totalSales = toNum(summaryAggregate?._sum?.totalAmount);
  const totalBills = Number(summaryAggregate?._count?.id || 0);
  return {
    summary: { totalSales: Number(totalSales.toFixed(2)), totalBills, avgPerBill: totalBills > 0 ? Number((totalSales / totalBills).toFixed(2)) : 0, totalDiscount: toNum(summaryAggregate?._sum?.totalDiscount), totalVat: toNum(summaryAggregate?._sum?.vat) },
    rows,
    pagination: { page, pageSize, total, totalPages: Math.max(Math.ceil(total / pageSize), 1) },
    sorting: { sortBy, sortDirection },
  };
};

const getProductPerformance = async ({ branchId, query }) => {
  const sales = await repository.findSalesForProductPerformance(buildSalesWhere({ branchId, query }));
  const topByRevenue = await getTopProductsFromSales({ saleIds: sales.map((sale) => sale.id), branchId });
  const totalProductsSold = topByRevenue.length;
  const totalUnitsSold = topByRevenue.reduce((sum, item) => sum + toNum(item.qty), 0);
  const totalSalesValue = topByRevenue.reduce((sum, item) => sum + toNum(item.sales), 0);
  const lowStockBestSellers = topByRevenue.filter((item) => item.stockLeft <= 2).slice(0, 5).map((item) => ({ id: item.id, name: item.name, soldQty: item.qty, stockLeft: item.stockLeft, reorderHint: item.stockLeft === 0 ? 'สินค้าหมดแล้ว ควรรีบเติมสต๊อก' : 'เหลือน้อยกว่าระดับปลอดภัย' }));
  const balances = await repository.findPositiveStockBalances(branchId);
  const hotProductIds = new Set(topByRevenue.map((item) => item.productId).filter(Boolean));
  const slowMoving = balances.filter((balance) => !hotProductIds.has(balance.productId)).slice(0, 10).map((balance) => ({ id: balance.productId || balance.id, name: balance.product?.name || `Product #${balance.productId}`, stockLeft: toNum(balance.quantity) - toNum(balance.reserved), lastSoldAt: null, daysWithoutSale: 0 }));
  return { summary: { totalProductsSold, totalUnitsSold, totalSalesValue: Number(totalSalesValue.toFixed(2)), lowStockHotProducts: lowStockBestSellers.length }, topByRevenue, slowMoving, lowStockBestSellers };
};

const getSalesDetail = async ({ branchId, saleId }) => {
  const sale = await repository.findSaleDetail(branchId, saleId);
  if (!sale) return null;
  const { itemsRaw, paymentsRaw } = await repository.findSaleDetailChildren(saleId);
  const items = itemsRaw.map((item) => ({ id: item.id, productName: getSaleItemName(item), barcode: getSaleItemBarcode(item), qty: getSaleItemQty(item), unitPrice: getSaleItemUnitPrice(item), discountAmount: getSaleItemDiscount(item), lineTotal: getSaleItemLineTotal(item) }));
  const payments = paymentsRaw.map((payment) => ({ id: payment.id, method: payment.items?.[0]?.paymentMethod || 'CASH', amount: (payment.items || []).reduce((sum, item) => sum + toNum(item.amount), 0), paidAt: payment.receivedAt || payment.createdAt || null, reference: payment.code || '' }));
  const beforeVat = D(sale.totalAmount).minus(D(sale.vat));
  return {
    sale: {
      id: sale.id, saleNo: sale.taxInvoiceNumber || sale.code || `SALE-${sale.id}`, soldAt: sale.soldAt,
      customerName: sale.customer?.name || 'ลูกค้าทั่วไป', customerPhone: '-', employeeName: sale.employee?.name || '-',
      paymentMethod: payments[0]?.method || 'CASH', paymentStatus: sale.statusPayment || 'UNPAID', saleStatus: sale.status || 'COMPLETED',
      branchName: sale.branch?.name || '-', note: sale.note || sale.remark || '', subtotal: toNum(sale.totalBeforeDiscount),
      discountAmount: toNum(sale.totalDiscount), beforeVat: toNum(beforeVat), vatAmount: toNum(sale.vat), totalAmount: toNum(sale.totalAmount),
      receivedAmount: toNum(sale.receivedAmount), changeAmount: toNum(sale.changeAmount),
    },
    items,
    payments,
    timeline: [{ id: 1, label: 'สร้างรายการขาย', at: sale.soldAt, by: sale.employee?.name || '-' }, ...payments.map((payment, index) => ({ id: `payment-${payment.id}`, label: 'บันทึกการชำระเงิน', at: payment.paidAt, by: sale.employee?.name || '-', sortIndex: index + 1 }))],
  };
};

const getSalesTaxReport = async ({ branchId, startDate, endDate }) => {
  const parsedStart = startOfDay(startDate);
  const parsedEnd = endOfDay(endDate);
  if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) return { invalidDate: true };
  const records = await repository.prisma.outputVatRecord.findMany({
    where: {
      branchId: Number(branchId),
      documentDate: { gte: parsedStart, lte: parsedEnd },
      taxDocument: {
        status: { in: ['REGISTERED', 'UNDER_REVIEW', 'APPROVED'] },
        issuedDocumentNumber: { not: null },
      },
    },
    include: { taxDocument: { select: { status: true } } },
    orderBy: [{ documentDate: 'asc' }, { taxDocumentId: 'asc' }],
  });
  const project = (record, type) => {
    const snapshot = record.documentSnapshot || {};
    const recipient = record.recipientSnapshot || snapshot.recipient || {};
    const sign = record.ledgerType === 'OUTPUT_VAT_ADJUSTMENT' ? -1 : 1;
    return {
      outputVatRecordId: record.id,
      taxDocumentId: record.taxDocumentId,
      taxPeriodId: record.taxPeriodId || null,
      date: record.documentDate,
      taxInvoiceNumber: record.issuedDocumentNumber,
      taxInvoiceKind: record.taxInvoiceKind || null,
      customerName: record.counterpartyName || recipient.legalName || snapshot.counterpartyName || '-',
      taxId: record.counterpartyTaxId || recipient.taxId || '',
      baseAmount: sign * toNum(record.subtotalAmount),
      vatAmount: sign * toNum(record.taxAmount),
      totalAmount: sign * toNum(record.totalAmount),
      status: record.taxDocument.status,
      originalTaxDocumentId: record.originalTaxDocumentId || null,
      type,
    };
  };
  const sales = records.filter((record) => record.ledgerType === 'OUTPUT_VAT').map((record) => project(record, 'sale'));
  const returns = records.filter((record) => record.ledgerType === 'OUTPUT_VAT_ADJUSTMENT').map((record) => project(record, 'return'));
  return {
    sales,
    returns,
    period: { start: parsedStart, end: parsedEnd },
    authority: 'OUTPUT_VAT_RECORD',
  };
};

module.exports = { getSalesDashboard, getSalesList, getProductPerformance, getSalesDetail, getSalesTaxReport };
