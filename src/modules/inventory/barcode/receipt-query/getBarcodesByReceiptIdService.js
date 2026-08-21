const repository = require('./getBarcodesByReceiptIdRepository');
const generationService = require('../generation/generateMissingBarcodesService');

async function getBarcodesByReceiptId({ receiptId, branchId, kind, onlyUnscanned, onlyUnactivated, includeFallback }) {
  const anyExisting = await repository.findAnyBarcode(receiptId, branchId);
  if (!anyExisting) {
    await generationService.executeGenerateMissingBarcodes({
      receiptId,
      branchId,
      dryRun: false,
      lotLabelPerLot: 1,
    });
  }

  const rows = await repository.findBarcodeRows({
    receiptId,
    branchId,
    kind,
    onlyUnscanned,
    onlyUnactivated,
  });

  const productIds = new Set();
  for (const row of rows) {
    if (row?.stockItem?.productId) productIds.add(row.stockItem.productId);
    const poProductId = row?.receiptItem?.purchaseOrderItem?.productId;
    if (poProductId) productIds.add(poProductId);
  }

  const products = await repository.findProducts(Array.from(productIds));
  const productMap = new Map(products.map((product) => [product.id, product]));

  const receiptItemIds = includeFallback
    ? Array.from(new Set(rows.map((row) => row.receiptItemId).filter(Boolean)))
    : [];
  const fallbackItems = includeFallback
    ? await repository.findStockItemsByReceiptItemIds(branchId, receiptItemIds)
    : [];
  const fallbackMap = new Map();
  for (const stockItem of fallbackItems) {
    if (stockItem?.purchaseOrderReceiptItemId != null && !fallbackMap.has(stockItem.purchaseOrderReceiptItemId)) {
      fallbackMap.set(stockItem.purchaseOrderReceiptItemId, stockItem);
    }
  }

  return rows.map((barcode) => {
    const productId = barcode.stockItem?.productId ?? barcode.receiptItem?.purchaseOrderItem?.productId ?? null;
    const product = productId ? productMap.get(productId) : null;
    const fallback = barcode.stockItemId
      ? null
      : barcode.stockItem ?? (includeFallback && barcode.receiptItemId ? fallbackMap.get(barcode.receiptItemId) : null);
    const kindValue = barcode.kind ?? (barcode.stockItemId ? 'SN' : barcode.simpleLotId ? 'LOT' : null);
    const quantity = Number(barcode.receiptItem?.quantity || 0);

    return {
      id: barcode.id,
      barcode: barcode.barcode,
      printed: !!barcode.printed,
      kind: kindValue,
      status: barcode.status || null,
      stockItemStatus: barcode.stockItem?.status ?? fallback?.status ?? null,
      stockItemSoldAt: barcode.stockItem?.soldAt ?? fallback?.soldAt ?? null,
      stockItemSaleItemId: barcode.stockItem?.saleItems?.[0]?.id ?? fallback?.saleItems?.[0]?.id ?? null,
      stockItemId: barcode.stockItemId ?? fallback?.id ?? null,
      simpleLotId: barcode.simpleLotId ?? null,
      receiptItemId: barcode.receiptItemId ?? null,
      serialNumber: barcode.stockItem?.serialNumber ?? fallback?.serialNumber ?? null,
      productId,
      productName: product?.name ?? null,
      productSpec: null,
      qtyLabelsSuggested: kindValue === 'LOT' ? Math.max(1, quantity || 1) : 1,
    };
  });
}

module.exports = { getBarcodesByReceiptId };
