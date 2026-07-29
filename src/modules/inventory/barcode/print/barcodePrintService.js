'use strict';

const generateBarcodeService = require('../generate/generateBarcodeService');
const repository = require('./barcodePrintRepository');

const extractReceiptId = (body, query, headerValue) => {
  const pick = (source) => {
    if (source == null) return undefined;
    if (typeof source === 'number' || (typeof source === 'string' && source.trim() !== '')) {
      const number = Number(source);
      if (Number.isFinite(number) && number > 0) return number;
    }
    if (typeof source !== 'object') return undefined;
    const candidates = [
      source.purchaseOrderReceiptId,
      source.receiptId,
      source.id,
      source?.purchaseOrderReceipt?.id,
      source?.payload?.id,
      source?.data?.id,
      source?.purchaseOrderReceiptId?.id,
      source?.purchaseOrderReceiptId?.purchaseOrderReceiptId,
    ];
    for (const candidate of candidates) {
      const number = Number(candidate);
      if (Number.isFinite(number) && number > 0) return number;
    }
    return undefined;
  };
  return pick(body) ?? pick(query) ?? Number(headerValue);
};

const resolveProducts = async (rows) => {
  const productIds = new Set();
  for (const row of rows) {
    if (row.stockItem?.productId) productIds.add(row.stockItem.productId);
    const poProductId = row.receiptItem?.purchaseOrderItem?.productId;
    if (poProductId) productIds.add(poProductId);
  }
  const products = productIds.size
    ? await repository.findProductsByIds(Array.from(productIds))
    : [];
  return new Map(products.map((product) => [product.id, product]));
};

const getPrintBatch = async ({ branchId, receiptIds }) => {
  const existing = await repository.findExistingReceiptIds({ branchId, receiptIds });
  const existingIds = new Set(existing.map((row) => row.purchaseOrderReceiptId));
  for (const receiptId of receiptIds.filter((id) => !existingIds.has(id))) {
    await generateBarcodeService.generateMissingBarcodes({
      receiptId,
      branchId,
      dryRun: false,
      lotLabelPerLot: 1,
    });
  }

  const rows = await repository.findPrintBatchRows({ branchId, receiptIds });
  const productMap = await resolveProducts(rows);
  return rows.map((row) => {
    const stockProductId = row.stockItem?.productId ?? null;
    const purchaseProductId = row.receiptItem?.purchaseOrderItem?.productId ?? null;
    const productId = stockProductId ?? purchaseProductId;
    const kind = row.kind ?? (row.stockItemId ? 'SN' : row.simpleLotId ? 'LOT' : null);
    const quantity = Number(row.receiptItem?.quantity || 0);
    return {
      receiptId: row.purchaseOrderReceiptId,
      id: row.id,
      barcode: row.barcode,
      printed: !!row.printed,
      kind,
      status: row.status || null,
      productId: productId ?? null,
      productName: productId ? productMap.get(productId)?.name ?? null : null,
      qtyLabelsSuggested: kind === 'LOT' ? Math.max(1, quantity || 1) : 1,
    };
  });
};

const getPendingPrintReceipts = async ({ branchId }) => {
  const receipts = await repository.findPendingPrintReceipts({ branchId });
  return receipts
    .map((receipt) => {
      const supplier = receipt.purchaseOrder?.supplier;
      const creditLimit = Number(supplier?.creditLimit || 0);
      const creditBalance = Number(supplier?.creditBalance || 0);
      const total = receipt.barcodeReceiptItem.length;
      const printed = receipt.barcodeReceiptItem.filter((item) => item.printed).length;
      const pending = total - printed;
      return {
        id: receipt.id,
        code: receipt.code,
        tax: receipt.supplierTaxInvoiceNumber,
        purchaseOrderCode: receipt.purchaseOrder?.code || '-',
        supplier: supplier?.name || '-',
        createdAt: receipt.createdAt,
        total,
        printed,
        pending,
        scanned: printed,
        totalSN: receipt.barcodeReceiptItem.filter((item) => item.kind === 'SN').length,
        totalLOT: receipt.barcodeReceiptItem.filter((item) => item.kind === 'LOT').length,
        printedSN: receipt.barcodeReceiptItem.filter((item) => item.printed && item.kind === 'SN').length,
        printedLOT: receipt.barcodeReceiptItem.filter((item) => item.printed && item.kind === 'LOT').length,
        creditRemaining: creditLimit - creditBalance,
        creditBalance,
      };
    })
    .filter((row) => row.pending > 0);
};

const searchReprintReceipts = async ({ branchId, mode, query, supplierKeyword, printed, limit }) => {
  const parsedLimit = Number(limit ?? 50);
  const take = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 50)
    : 50;
  const where = {
    branchId,
    barcodeReceiptItem: printed ? { some: { printed: true } } : { some: {} },
  };
  const qFilter = query ? { contains: query, mode: 'insensitive' } : null;
  const supplierFilter = supplierKeyword
    ? { contains: supplierKeyword, mode: 'insensitive' }
    : null;

  if (mode === 'RC') {
    if (qFilter) where.code = qFilter;
    if (supplierFilter) where.purchaseOrder = { is: { supplier: { is: { name: supplierFilter } } } };
  } else if (mode === 'PO') {
    where.purchaseOrder = {
      is: {
        ...(qFilter ? { code: qFilter } : {}),
        ...(supplierFilter ? { supplier: { is: { name: supplierFilter } } } : {}),
      },
    };
  } else if (mode === 'SUP') {
    where.purchaseOrder = {
      is: { supplier: { is: { name: supplierFilter || qFilter || { contains: '', mode: 'insensitive' } } } },
    };
  } else if (mode === 'ALL') {
    const or = [];
    if (qFilter) {
      or.push({ code: qFilter });
      or.push({ purchaseOrder: { is: { code: qFilter } } });
    }
    if (supplierFilter) {
      or.push({ purchaseOrder: { is: { supplier: { is: { name: supplierFilter } } } } });
    }
    if (or.length) where.OR = or;
  } else {
    if (qFilter) where.code = qFilter;
    if (supplierFilter) where.purchaseOrder = { is: { supplier: { is: { name: supplierFilter } } } };
  }

  const receipts = await repository.searchReceiptsForReprint({ where, limit: take });
  return receipts.map((receipt) => ({
    id: receipt.id,
    code: receipt.code,
    purchaseOrderCode: receipt.purchaseOrder?.code || '-',
    supplier: receipt.purchaseOrder?.supplier?.name || '-',
    createdAt: receipt.createdAt,
  }));
};

const markPrinted = async ({ branchId, receiptId }) => {
  const [itemsResult, receiptResult] = await repository.markPrinted({ branchId, receiptId });
  return { updated: itemsResult.count, receiptUpdated: receiptResult.count };
};

const getReprintBarcodes = async ({ receiptId, branchId }) => {
  const receipt = await repository.findReceipt({ branchId, receiptId });
  if (!receipt) return null;
  const rows = await repository.findReprintRows({ branchId, receiptId });
  const productMap = await resolveProducts(rows);

  let purchaseOrderItemMap = new Map();
  let receiptToPurchaseItemMap = new Map();
  if (receipt.purchaseOrderId) {
    const purchaseOrderItems = await repository.findPurchaseOrderItems(receipt.purchaseOrderId);
    purchaseOrderItemMap = new Map(purchaseOrderItems.map((item) => [item.id, item]));
    const receiptItemIds = Array.from(new Set(rows.map((row) => row.receiptItemId).filter(Boolean)));
    if (receiptItemIds.length) {
      const receiptItems = await repository.findReceiptItems(receiptItemIds);
      receiptToPurchaseItemMap = new Map(receiptItems.map((item) => [item.id, item.purchaseOrderItemId]));
    }
  }

  const receiptItemIds = Array.from(new Set(rows.map((row) => row.receiptItemId).filter(Boolean)));
  const fallbackRows = receiptItemIds.length
    ? await repository.findFallbackStockItems({ branchId, receiptItemIds })
    : [];
  const fallbackMap = new Map();
  for (const stockItem of fallbackRows) {
    if (!fallbackMap.has(stockItem.purchaseOrderReceiptItemId)) {
      fallbackMap.set(stockItem.purchaseOrderReceiptItemId, stockItem);
    }
  }

  return rows.map((row) => {
    const purchaseItemId = receiptToPurchaseItemMap.get(row.receiptItemId);
    const purchaseItem = purchaseItemId ? purchaseOrderItemMap.get(purchaseItemId) : null;
    const product =
      (row.stockItem?.productId && productMap.get(row.stockItem.productId)) ||
      (row.receiptItem?.purchaseOrderItem?.productId &&
        productMap.get(row.receiptItem.purchaseOrderItem.productId)) ||
      purchaseItem?.product ||
      (purchaseItem?.productId ? productMap.get(purchaseItem.productId) : null);
    const fallback = row.stockItemId ? null : fallbackMap.get(row.receiptItemId);
    return {
      id: row.id,
      barcode: row.barcode,
      printed: !!row.printed,
      stockItemStatus: row.stockItem?.status ?? null,
      stockItemSoldAt: row.stockItem?.soldAt ?? null,
      stockItemSaleItemId: row.stockItem?.saleItems?.[0]?.id ?? null,
      stockItemId: row.stockItemId ?? fallback?.id ?? null,
      serialNumber: row.stockItem?.serialNumber ?? fallback?.serialNumber ?? null,
      productId:
        product?.id ?? row.stockItem?.productId ?? row.receiptItem?.purchaseOrderItem?.productId ?? null,
      productName: product?.name ?? null,
      productSpec: null,
    };
  });
};

module.exports = {
  extractReceiptId,
  getPrintBatch,
  getPendingPrintReceipts,
  searchReprintReceipts,
  markPrinted,
  getReprintBarcodes,
};
