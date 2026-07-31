const repository = require('./barcodeAuditRepository');

function buildEmptyAudit(receiptId, includeDetails) {
  return {
    receiptId,
    summary: {
      structured: { items: 0, stockItems: 0, barcodes: 0 },
      simple: { items: 0, simpleLots: 0, barcodes: 0 },
      mixedItems: 0,
      unknownItems: 0,
    },
    anomalies: [],
    details: includeDetails ? [] : undefined,
  };
}

async function auditReceiptBarcodes({ receiptId, branchId, includeDetails }) {
  const receipt = await repository.findReceipt(receiptId, branchId);
  if (!receipt) {
    const error = new Error('RECEIPT_NOT_FOUND');
    error.status = 404;
    throw error;
  }

  const receiptItems = await repository.findReceiptItems(receiptId);
  const receiptItemIds = receiptItems.map((item) => item.id);
  if (receiptItemIds.length === 0) return buildEmptyAudit(receiptId, includeDetails);

  const [barcodeItems, stockItems, simpleLots] = await Promise.all([
    repository.findBarcodeItems(receiptId, branchId),
    repository.findStockItems(branchId, receiptItemIds),
    repository.findSimpleLots(branchId, receiptItemIds),
  ]);

  const countMap = {
    barcodeByItem: new Map(),
    barcodeSnByItem: new Map(),
    barcodeLotByItem: new Map(),
    stockByItem: new Map(),
    simpleLotByItem: new Map(),
    samplesByItem: new Map(),
  };
  const increment = (map, key) => map.set(key, (map.get(key) || 0) + 1);

  for (const barcode of barcodeItems) {
    const itemId = barcode.receiptItemId;
    increment(countMap.barcodeByItem, itemId);
    if (barcode.stockItemId) increment(countMap.barcodeSnByItem, itemId);
    if (barcode.simpleLotId) increment(countMap.barcodeLotByItem, itemId);
    const samples = countMap.samplesByItem.get(itemId) || [];
    if (samples.length < 5) samples.push(barcode.barcode);
    countMap.samplesByItem.set(itemId, samples);
  }
  for (const stock of stockItems) increment(countMap.stockByItem, stock.purchaseOrderReceiptItemId);
  for (const lot of simpleLots) increment(countMap.simpleLotByItem, lot.receiptItemId);

  let structuredItems = 0;
  let structuredStock = 0;
  let structuredBarcodes = 0;
  let simpleItems = 0;
  let simpleLotsCount = 0;
  let simpleBarcodes = 0;
  let mixedItems = 0;
  let unknownItems = 0;
  const anomalies = [];
  const details = [];

  const addAnomaly = (type, itemId, info) => {
    let anomaly = anomalies.find((entry) => entry.type === type);
    if (!anomaly) {
      anomaly = { type, count: 0, examples: [] };
      anomalies.push(anomaly);
    }
    anomaly.count += 1;
    if (anomaly.examples.length < 10) anomaly.examples.push({ receiptItemId: itemId, ...info });
  };

  for (const item of receiptItems) {
    const id = item.id;
    const stockCount = countMap.stockByItem.get(id) || 0;
    const simpleLotCount = countMap.simpleLotByItem.get(id) || 0;
    const barcodeTotal = countMap.barcodeByItem.get(id) || 0;
    const barcodeSn = countMap.barcodeSnByItem.get(id) || 0;
    const barcodeLot = countMap.barcodeLotByItem.get(id) || 0;
    const isStructured = stockCount > 0 || barcodeSn > 0;
    const isSimple = simpleLotCount > 0 || (barcodeLot > 0 && !isStructured);

    if (isStructured && isSimple) mixedItems += 1;
    if (!isStructured && !isSimple) unknownItems += 1;

    if (isStructured) {
      structuredItems += 1;
      structuredStock += stockCount;
      structuredBarcodes += barcodeTotal;
      if (stockCount > barcodeTotal) {
        addAnomaly('STRUCTURED_MISSING_SN_BARCODES', id, {
          stockItems: stockCount,
          barcodes: barcodeTotal,
          samples: countMap.samplesByItem.get(id) || [],
        });
      }
      if (barcodeLot > 0) addAnomaly('STRUCTURED_HAS_LOT_BARCODES', id, { lotBarcodes: barcodeLot });
    }

    if (isSimple) {
      simpleItems += 1;
      simpleLotsCount += simpleLotCount;
      simpleBarcodes += barcodeTotal;
      if (simpleLotCount > 0 && barcodeTotal === 0) {
        addAnomaly('SIMPLE_MISSING_LOT_BARCODES', id, { simpleLots: simpleLotCount });
      }
      if (simpleLotCount > 0 && barcodeTotal > simpleLotCount) {
        addAnomaly('SIMPLE_HAS_MULTIPLE_BARCODES', id, {
          simpleLots: simpleLotCount,
          barcodes: barcodeTotal,
          samples: countMap.samplesByItem.get(id) || [],
        });
      }
      if (barcodeSn > 0) addAnomaly('SIMPLE_HAS_SN_BARCODES', id, { snBarcodes: barcodeSn });
    }

    if (includeDetails) {
      details.push({
        receiptItemId: id,
        quantity: Number(item.quantity || 0),
        stockItems: stockCount,
        simpleLots: simpleLotCount,
        barcodesTotal: barcodeTotal,
        barcodesSN: barcodeSn,
        barcodesLOT: barcodeLot,
        samples: countMap.samplesByItem.get(id) || [],
        flags: {
          isStructured,
          isSimple,
          mixed: isStructured && isSimple,
          unknown: !isStructured && !isSimple,
        },
      });
    }
  }

  return {
    receiptId,
    summary: {
      structured: { items: structuredItems, stockItems: structuredStock, barcodes: structuredBarcodes },
      simple: { items: simpleItems, simpleLots: simpleLotsCount, barcodes: simpleBarcodes },
      mixedItems,
      unknownItems,
    },
    anomalies,
    details: includeDetails ? details : undefined,
  };
}

module.exports = { auditReceiptBarcodes };
