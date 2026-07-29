'use strict';

const generateBarcodeService = require('../generate/generateBarcodeService');
const receiptBarcodeQueryRepository = require('./receiptBarcodeQueryRepository');

const ensureBarcodesExist = async ({ receiptId, branchId }) => {
  const existing = await receiptBarcodeQueryRepository.findAnyBarcode({ receiptId, branchId });
  if (existing) return;

  await generateBarcodeService.generateMissingBarcodes({
    receiptId,
    branchId,
    dryRun: false,
    lotLabelPerLot: 1,
  });
};

const getBarcodesByReceipt = async ({
  receiptId,
  branchId,
  kind,
  onlyUnscanned,
  onlyUnactivated,
  includeFallback,
}) => {
  await ensureBarcodesExist({ receiptId, branchId });

  const rows = await receiptBarcodeQueryRepository.findReceiptBarcodes({
    receiptId,
    branchId,
    kind,
    onlyUnscanned,
    onlyUnactivated,
  });

  const productIds = new Set();
  for (const row of rows) {
    if (row.stockItem?.productId) productIds.add(row.stockItem.productId);
    const poProductId = row.receiptItem?.purchaseOrderItem?.productId;
    if (poProductId) productIds.add(poProductId);
  }

  const products = productIds.size
    ? await receiptBarcodeQueryRepository.findProductsByIds(Array.from(productIds))
    : [];
  const productMap = new Map(products.map((product) => [product.id, product]));

  const receiptItemIds = includeFallback
    ? Array.from(new Set(rows.map((row) => row.receiptItemId).filter(Boolean)))
    : [];
  const fallbackRows = receiptItemIds.length
    ? await receiptBarcodeQueryRepository.findFallbackStockItems({ branchId, receiptItemIds })
    : [];
  const fallbackMap = new Map();
  for (const stockItem of fallbackRows) {
    const key = stockItem.purchaseOrderReceiptItemId;
    if (key != null && !fallbackMap.has(key)) fallbackMap.set(key, stockItem);
  }

  return rows.map((barcodeRow) => {
    const stockProductId = barcodeRow.stockItem?.productId ?? null;
    const purchaseProductId = barcodeRow.receiptItem?.purchaseOrderItem?.productId ?? null;
    const productId = stockProductId ?? purchaseProductId;
    const fallbackStockItem = barcodeRow.stockItemId
      ? null
      : barcodeRow.stockItem ??
        (includeFallback && barcodeRow.receiptItemId
          ? fallbackMap.get(barcodeRow.receiptItemId)
          : null);

    const resolvedStockItemId = barcodeRow.stockItemId ?? fallbackStockItem?.id ?? null;
    const serialNumber = barcodeRow.stockItem?.serialNumber ?? fallbackStockItem?.serialNumber ?? null;
    const stockItemStatus = barcodeRow.stockItem?.status ?? fallbackStockItem?.status ?? null;
    const stockItemSoldAt = barcodeRow.stockItem?.soldAt ?? fallbackStockItem?.soldAt ?? null;
    const stockItemSaleItemId =
      barcodeRow.stockItem?.saleItems?.[0]?.id ?? fallbackStockItem?.saleItems?.[0]?.id ?? null;
    const resolvedKind =
      barcodeRow.kind ?? (barcodeRow.stockItemId ? 'SN' : barcodeRow.simpleLotId ? 'LOT' : null);
    const quantity = Number(barcodeRow.receiptItem?.quantity || 0);

    return {
      id: barcodeRow.id,
      barcode: barcodeRow.barcode,
      printed: !!barcodeRow.printed,
      kind: resolvedKind,
      status: barcodeRow.status || null,
      stockItemStatus,
      stockItemSoldAt,
      stockItemSaleItemId,
      stockItemId: resolvedStockItemId,
      simpleLotId: barcodeRow.simpleLotId ?? null,
      receiptItemId: barcodeRow.receiptItemId ?? null,
      serialNumber,
      productId: productId ?? null,
      productName: productId ? productMap.get(productId)?.name ?? null : null,
      productSpec: null,
      qtyLabelsSuggested: resolvedKind === 'LOT' ? Math.max(1, quantity || 1) : 1,
    };
  });
};

module.exports = {
  ensureBarcodesExist,
  getBarcodesByReceipt,
};
