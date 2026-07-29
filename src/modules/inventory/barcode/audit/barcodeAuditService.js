'use strict';

const auditRepository = require('./barcodeAuditRepository');

const increment = (map, key, amount = 1) =>
  map.set(key, (map.get(key) || 0) + amount);

const auditReceiptBarcodes = async ({ receiptId, branchId, includeDetails }) => {
  const receipt = await auditRepository.findReceipt({ receiptId, branchId });
  if (!receipt) return null;

  const receiptItems = await auditRepository.findReceiptItems({ receiptId });
  const receiptItemIds = receiptItems.map((item) => item.id);

  if (receiptItemIds.length === 0) {
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

  const [barcodeRows, stockItems, simpleLots] = await Promise.all([
    auditRepository.findBarcodeRows({ receiptId, branchId }),
    auditRepository.findStockItems({ branchId, receiptItemIds }),
    auditRepository.findSimpleLots({ branchId, receiptItemIds }),
  ]);

  const counts = {
    barcodeByItem: new Map(),
    snBarcodeByItem: new Map(),
    lotBarcodeByItem: new Map(),
    stockByItem: new Map(),
    lotByItem: new Map(),
    samplesByItem: new Map(),
  };

  for (const row of barcodeRows) {
    const key = row.receiptItemId;
    increment(counts.barcodeByItem, key);
    if (row.stockItemId) increment(counts.snBarcodeByItem, key);
    if (row.simpleLotId) increment(counts.lotBarcodeByItem, key);
    const samples = counts.samplesByItem.get(key) || [];
    if (samples.length < 5) samples.push(row.barcode);
    counts.samplesByItem.set(key, samples);
  }

  for (const item of stockItems) {
    increment(counts.stockByItem, item.purchaseOrderReceiptItemId);
  }
  for (const lot of simpleLots) increment(counts.lotByItem, lot.receiptItemId);

  const summary = {
    structured: { items: 0, stockItems: 0, barcodes: 0 },
    simple: { items: 0, simpleLots: 0, barcodes: 0 },
    mixedItems: 0,
    unknownItems: 0,
  };
  const anomalies = [];
  const details = [];

  const addAnomaly = (type, receiptItemId, info) => {
    let anomaly = anomalies.find((item) => item.type === type);
    if (!anomaly) {
      anomaly = { type, count: 0, examples: [] };
      anomalies.push(anomaly);
    }
    anomaly.count += 1;
    if (anomaly.examples.length < 10) {
      anomaly.examples.push({ receiptItemId, ...info });
    }
  };

  for (const item of receiptItems) {
    const id = item.id;
    const stockCount = counts.stockByItem.get(id) || 0;
    const simpleLotCount = counts.lotByItem.get(id) || 0;
    const barcodeCount = counts.barcodeByItem.get(id) || 0;
    const snBarcodeCount = counts.snBarcodeByItem.get(id) || 0;
    const lotBarcodeCount = counts.lotBarcodeByItem.get(id) || 0;
    const samples = counts.samplesByItem.get(id) || [];

    const isStructured = stockCount > 0 || snBarcodeCount > 0;
    const isSimple = simpleLotCount > 0 || (lotBarcodeCount > 0 && !isStructured);

    if (isStructured && isSimple) summary.mixedItems += 1;
    if (!isStructured && !isSimple) summary.unknownItems += 1;

    if (isStructured) {
      summary.structured.items += 1;
      summary.structured.stockItems += stockCount;
      summary.structured.barcodes += barcodeCount;
      if (stockCount > barcodeCount) {
        addAnomaly('STRUCTURED_MISSING_SN_BARCODES', id, {
          stockItems: stockCount,
          barcodes: barcodeCount,
          samples,
        });
      }
      if (lotBarcodeCount > 0) {
        addAnomaly('STRUCTURED_HAS_LOT_BARCODES', id, { lotBarcodes: lotBarcodeCount });
      }
    }

    if (isSimple) {
      summary.simple.items += 1;
      summary.simple.simpleLots += simpleLotCount;
      summary.simple.barcodes += barcodeCount;
      if (simpleLotCount > 0 && barcodeCount === 0) {
        addAnomaly('SIMPLE_MISSING_LOT_BARCODES', id, { simpleLots: simpleLotCount });
      }
      if (simpleLotCount > 0 && barcodeCount > simpleLotCount) {
        addAnomaly('SIMPLE_HAS_MULTIPLE_BARCODES', id, {
          simpleLots: simpleLotCount,
          barcodes: barcodeCount,
          samples,
        });
      }
      if (snBarcodeCount > 0) {
        addAnomaly('SIMPLE_HAS_SN_BARCODES', id, { snBarcodes: snBarcodeCount });
      }
    }

    if (includeDetails) {
      details.push({
        receiptItemId: id,
        quantity: Number(item.quantity || 0),
        stockItems: stockCount,
        simpleLots: simpleLotCount,
        barcodesTotal: barcodeCount,
        barcodesSN: snBarcodeCount,
        barcodesLOT: lotBarcodeCount,
        samples,
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
    summary,
    anomalies,
    details: includeDetails ? details : undefined,
  };
};

module.exports = { auditReceiptBarcodes };
