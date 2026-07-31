const repository = require('./barcodePrintReprintRepository');
const generationService = require('../generation/generateMissingBarcodesService');

const toInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const parseReceiptIds = (raw) =>
  String(raw || '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

const getPrintBatch = async ({ branchId, rawIds }) => {
  if (!Number.isInteger(branchId)) {
    return { status: 400, body: { message: 'ต้องมีสิทธิ์สาขา' } };
  }
  if (!String(rawIds || '').trim()) {
    return { status: 400, body: { message: 'กรุณาระบุ ids เช่น ?ids=458,451' } };
  }

  const ids = parseReceiptIds(rawIds);
  if (!ids.length) {
    return { status: 400, body: { message: 'ids ไม่ถูกต้อง' } };
  }

  const existing = await repository.findReceiptBarcodeCoverage(branchId, ids);
  const covered = new Set(existing.map((row) => row.purchaseOrderReceiptId));
  const missingIds = ids.filter((id) => !covered.has(id));

  for (const receiptId of missingIds) {
    await generationService.generateMissingBarcodes({
      receiptId,
      branchId,
      dryRun: false,
      lotLabelPerLot: 1,
    });
  }

  const rows = await repository.findPrintBatchRows(branchId, ids);
  const productIds = new Set();
  for (const row of rows) {
    if (row.stockItem?.productId) productIds.add(row.stockItem.productId);
    if (row.receiptItem?.purchaseOrderItem?.productId) {
      productIds.add(row.receiptItem.purchaseOrderItem.productId);
    }
  }

  const products = productIds.size
    ? await repository.findProductsByIds(Array.from(productIds))
    : [];
  const productMap = new Map(products.map((product) => [product.id, product]));

  const barcodes = rows.map((row) => {
    const productId = row.stockItem?.productId ?? row.receiptItem?.purchaseOrderItem?.productId ?? null;
    const kind = row.kind ?? (row.stockItemId ? 'SN' : row.simpleLotId ? 'LOT' : null);
    const quantity = Number(row.receiptItem?.quantity || 0);

    return {
      receiptId: row.purchaseOrderReceiptId,
      id: row.id,
      barcode: row.barcode,
      printed: !!row.printed,
      kind,
      status: row.status || null,
      productId,
      productName: productId ? productMap.get(productId)?.name ?? null : null,
      qtyLabelsSuggested: kind === 'LOT' ? Math.max(1, quantity || 1) : 1,
    };
  });

  return { status: 200, body: { success: true, count: barcodes.length, barcodes } };
};

const markPrinted = async ({ branchId, purchaseOrderReceiptId }) => {
  if (!branchId) {
    return { status: 401, body: { message: 'unauthorized: missing branchId' } };
  }
  if (!Number.isFinite(purchaseOrderReceiptId) || purchaseOrderReceiptId <= 0) {
    return {
      status: 400,
      body: { message: 'ต้องระบุ purchaseOrderReceiptId (หรือ receiptId/id)' },
    };
  }

  const [itemsResult, receiptResult] = await repository.markReceiptPrinted(
    branchId,
    purchaseOrderReceiptId
  );

  return {
    status: 200,
    body: {
      success: true,
      updated: itemsResult.count,
      receiptUpdated: receiptResult.count,
    },
  };
};

const getWaitingReceipts = async (branchId) => {
  if (!Number.isInteger(branchId)) {
    return { status: 400, body: { message: 'ต้องมี branchId' } };
  }

  const receipts = await repository.findReceiptsWaitingForPrint(branchId);
  const rows = receipts
    .map((receipt) => {
      const supplier = receipt.purchaseOrder?.supplier;
      const creditLimit = Number(supplier?.creditLimit || 0);
      const creditBalance = Number(supplier?.creditBalance || 0);
      const items = receipt.barcodeReceiptItem || [];
      const printed = items.filter((item) => item.printed).length;

      return {
        id: receipt.id,
        code: receipt.code,
        tax: receipt.supplierTaxInvoiceNumber,
        purchaseOrderCode: receipt.purchaseOrder?.code || '-',
        supplier: supplier?.name || '-',
        createdAt: receipt.createdAt,
        total: items.length,
        printed,
        pending: items.length - printed,
        scanned: printed,
        totalSN: items.filter((item) => item.kind === 'SN').length,
        totalLOT: items.filter((item) => item.kind === 'LOT').length,
        printedSN: items.filter((item) => item.printed && item.kind === 'SN').length,
        printedLOT: items.filter((item) => item.printed && item.kind === 'LOT').length,
        creditRemaining: creditLimit - creditBalance,
        creditBalance,
      };
    })
    .filter((receipt) => receipt.pending > 0);

  return { status: 200, body: rows };
};

const searchReprint = async ({ branchId, mode, query, supplierKeyword, printed, limit }) => {
  if (!Number.isInteger(branchId)) {
    return { status: 400, body: { message: 'ต้องมี branchId' } };
  }

  const q = String(query || '').trim();
  const supplier = String(supplierKeyword || '').trim();
  if (!q && !supplier) return { status: 200, body: [] };

  const normalizedMode = String(mode || 'RC').toUpperCase();
  const printedFlag = String(printed ?? 'true').toLowerCase() === 'true';
  const rawLimit = Number(limit ?? 50);
  const safeLimit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50)
    : 50;

  const where = {
    branchId,
    barcodeReceiptItem: printedFlag ? { some: { printed: true } } : { some: {} },
  };
  const qFilter = q ? { contains: q, mode: 'insensitive' } : null;
  const supplierFilter = supplier ? { contains: supplier, mode: 'insensitive' } : null;

  if (normalizedMode === 'RC') {
    if (qFilter) where.code = qFilter;
    if (supplierFilter) {
      where.purchaseOrder = { is: { supplier: { is: { name: supplierFilter } } } };
    }
  } else if (normalizedMode === 'PO') {
    where.purchaseOrder = {
      is: {
        ...(qFilter ? { code: qFilter } : {}),
        ...(supplierFilter
          ? { supplier: { is: { name: supplierFilter } } }
          : {}),
      },
    };
  } else if (normalizedMode === 'SUP') {
    where.purchaseOrder = {
      is: {
        supplier: {
          is: { name: supplierFilter || qFilter || { contains: '', mode: 'insensitive' } },
        },
      },
    };
  } else if (normalizedMode === 'ALL') {
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
    if (supplierFilter) {
      where.purchaseOrder = { is: { supplier: { is: { name: supplierFilter } } } };
    }
  }

  const receipts = await repository.searchReceiptsForReprint(where, safeLimit);
  return {
    status: 200,
    body: receipts.map((receipt) => ({
      id: receipt.id,
      code: receipt.code,
      purchaseOrderCode: receipt.purchaseOrder?.code || '-',
      supplier: receipt.purchaseOrder?.supplier?.name || '-',
      createdAt: receipt.createdAt,
    })),
  };
};

const getReprintBarcodes = async ({ receiptId, branchId }) => {
  if (!Number.isInteger(receiptId) || !Number.isInteger(branchId)) {
    return { status: 400, body: { message: 'พารามิเตอร์ไม่ถูกต้อง' } };
  }

  const receipt = await repository.findReceipt(receiptId, branchId);
  if (!receipt) {
    return { status: 404, body: { message: 'ไม่พบใบรับในสาขาของคุณ' } };
  }

  const items = await repository.findReprintItems(receiptId, branchId);
  const productIds = new Set();
  for (const item of items) {
    if (item.stockItem?.productId) productIds.add(item.stockItem.productId);
    if (item.receiptItem?.purchaseOrderItem?.productId) {
      productIds.add(item.receiptItem.purchaseOrderItem.productId);
    }
  }
  const products = productIds.size
    ? await repository.findProductsByIds(Array.from(productIds))
    : [];
  const productMap = new Map(products.map((product) => [product.id, product]));

  const receiptWithPo = await repository.findReceipt(receiptId, branchId, {
    purchaseOrderId: true,
  });
  let poItemMap = new Map();
  let receiptToPoItemMap = new Map();

  if (receiptWithPo?.purchaseOrderId) {
    const poItems = await repository.findPurchaseOrderItems(receiptWithPo.purchaseOrderId);
    poItemMap = new Map(poItems.map((item) => [item.id, item]));
    const receiptItemIds = Array.from(
      new Set(items.map((item) => item.receiptItemId).filter(Boolean))
    );
    if (receiptItemIds.length) {
      const receiptItems = await repository.findReceiptItems(receiptItemIds);
      receiptToPoItemMap = new Map(
        receiptItems.map((item) => [item.id, item.purchaseOrderItemId])
      );
    }
  }

  const barcodeIds = Array.from(new Set(items.map((item) => item.id).filter(Boolean)));
  const receiptItemIds = Array.from(
    new Set(items.map((item) => item.receiptItemId).filter(Boolean))
  );
  const barcodeLinks = barcodeIds.length
    ? await repository.findBarcodeStockLinks(barcodeIds, branchId)
    : [];
  const stockItems = receiptItemIds.length
    ? await repository.findStockItemsByReceiptItem(receiptItemIds, branchId)
    : [];
  const stockByBarcode = new Map(
    barcodeLinks
      .map((link) => [link.id, link.stockItem])
      .filter(([, stockItem]) => stockItem)
  );
  const stockByReceiptItem = new Map(
    stockItems
      .map((stockItem) => [stockItem.purchaseOrderReceiptItemId, stockItem])
      .filter(([key]) => key != null)
  );

  const barcodes = items.map((item) => {
    const directProduct =
      (item.stockItem?.productId && productMap.get(item.stockItem.productId)) ||
      (item.receiptItem?.purchaseOrderItem?.productId &&
        productMap.get(item.receiptItem.purchaseOrderItem.productId)) ||
      null;
    const poItemId = receiptToPoItemMap.get(item.receiptItemId);
    const poItem = poItemId ? poItemMap.get(poItemId) : null;
    const product = directProduct || poItem?.product || null;
    const fallbackStockItem = item.stockItemId
      ? null
      : stockByBarcode.get(item.id) || stockByReceiptItem.get(item.receiptItemId);

    return {
      id: item.id,
      barcode: item.barcode,
      printed: !!item.printed,
      stockItemStatus: item.stockItem?.status ?? null,
      stockItemSoldAt: item.stockItem?.soldAt ?? null,
      stockItemSaleItemId: item.stockItem?.saleItems?.[0]?.id ?? null,
      stockItemId: item.stockItemId ?? fallbackStockItem?.id ?? null,
      serialNumber: item.stockItem?.serialNumber ?? fallbackStockItem?.serialNumber ?? null,
      productId:
        product?.id ??
        item.stockItem?.productId ??
        item.receiptItem?.purchaseOrderItem?.productId ??
        null,
      productName: product?.name ?? null,
      productSpec: null,
    };
  });

  return { status: 200, body: { success: true, count: barcodes.length, barcodes } };
};

module.exports = {
  toInt,
  getPrintBatch,
  markPrinted,
  getWaitingReceipts,
  searchReprint,
  getReprintBarcodes,
};
