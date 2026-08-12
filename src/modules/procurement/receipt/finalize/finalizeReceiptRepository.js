const { prisma } = require('../../../../../lib/prisma');

const isLotRow = (row) => row?.kind === 'LOT' || row?.simpleLotId != null;
const toNumber = (value) => Number(value?.toString?.() ?? value ?? 0);

const isInventoryReceivedRow = (row) => {
  if (isLotRow(row)) {
    return row?.simpleLotId != null && String(row?.status || '').toUpperCase() === 'SN_RECEIVED';
  }
  return row?.stockItemId != null;
};

const expectedIdentityCountForReceiptItem = ({ quantity, mode } = {}) => {
  const qty = Math.max(0, toNumber(quantity));
  if (qty <= 0) return 0;
  return String(mode || '').toUpperCase() === 'SIMPLE' ? 1 : Math.ceil(qty);
};

const computeIdentityCoverageFromItems = (items = []) => {
  const rows = Array.isArray(items) ? items : [];
  let expected = 0;
  let active = 0;

  for (const item of rows) {
    const mode = item?.product?.mode || item?.purchaseOrderItem?.product?.mode || 'STRUCTURED';
    const requiredKind = String(mode).toUpperCase() === 'SIMPLE' ? 'LOT' : 'SN';
    const itemExpected = expectedIdentityCountForReceiptItem({ quantity: item?.quantity, mode });
    const barcodeRows = Array.isArray(item?.barcodeReceiptItem) ? item.barcodeReceiptItem : [];
    const itemActive = barcodeRows.filter((row) => (
      String(row?.status || '').toUpperCase() !== 'VOID' &&
      String(row?.kind || '').toUpperCase() === requiredKind
    )).length;

    expected += itemExpected;
    active += Math.min(itemExpected, itemActive);
  }

  return {
    expected,
    active,
    missing: Math.max(0, expected - active),
  };
};

const computePoStatusFromItems = (items = []) => {
  const rows = Array.isArray(items) ? items : [];
  if (rows.length === 0) return 'PENDING';

  let totalOrdered = 0;
  let totalReceived = 0;

  for (const item of rows) {
    const ordered = Math.max(0, toNumber(item?.quantity));
    totalOrdered += ordered;

    let receivedForItem = 0;
    const receiptItems = Array.isArray(item?.receipts) ? item.receipts : [];

    for (const receiptItem of receiptItems) {
      const receiptQty = Math.max(0, toNumber(receiptItem?.quantity));
      const barcodeRows = Array.isArray(receiptItem?.barcodeReceiptItem)
        ? receiptItem.barcodeReceiptItem
        : [];
      const lotRows = barcodeRows.filter(isLotRow);

      if (lotRows.length > 0) {
        if (lotRows.some(isInventoryReceivedRow)) receivedForItem += receiptQty;
        continue;
      }

      const receivedUnits = barcodeRows.filter(isInventoryReceivedRow).length;
      receivedForItem += Math.min(receiptQty, receivedUnits);
    }

    totalReceived += Math.min(ordered, receivedForItem);
  }

  if (totalOrdered <= 0 || totalReceived <= 0) return 'PENDING';
  if (totalReceived < totalOrdered) return 'PARTIALLY_RECEIVED';
  return 'COMPLETED';
};

const findReceipt = ({ id, branchId }) =>
  prisma.purchaseOrderReceipt.findFirst({
    where: { id, branchId },
    select: { id: true, statusReceipt: true, purchaseOrderId: true },
  });

const getIdentityCoverage = async (receiptId, client = prisma) => {
  const items = await client.purchaseOrderReceiptItem.findMany({
    where: { receiptId },
    select: {
      quantity: true,
      product: { select: { mode: true } },
      purchaseOrderItem: { select: { product: { select: { mode: true } } } },
      barcodeReceiptItem: { select: { kind: true, status: true } },
    },
  });

  return computeIdentityCoverageFromItems(items);
};

const getPendingCounts = async (receiptId, client = prisma) => {
  const rows = await client.barcodeReceiptItem.findMany({
    where: { receiptItem: { receiptId } },
    select: { id: true, kind: true, status: true, stockItemId: true, simpleLotId: true },
  });
  let pendingSN = 0;
  let pendingLOT = 0;
  for (const row of rows) {
    if (String(row?.status || '').toUpperCase() === 'VOID') continue;
    if (isLotRow(row)) {
      if (!isInventoryReceivedRow(row)) pendingLOT += 1;
    } else if (!isInventoryReceivedRow(row)) {
      pendingSN += 1;
    }
  }
  return { pendingSN, pendingLOT, total: rows.length };
};

const computePoStatus = async (purchaseOrderId, client = prisma) => {
  if (!purchaseOrderId) return 'PENDING';

  const items = await client.purchaseOrderItem.findMany({
    where: { purchaseOrderId },
    select: {
      quantity: true,
      receipts: {
        select: {
          quantity: true,
          barcodeReceiptItem: {
            select: { kind: true, status: true, stockItemId: true, simpleLotId: true },
          },
        },
      },
    },
  });

  return computePoStatusFromItems(items);
};

const syncPoStatus = async (purchaseOrderId, client = prisma) => {
  if (!purchaseOrderId) return 'PENDING';
  const poStatus = await computePoStatus(purchaseOrderId, client);
  await client.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status: poStatus },
  });
  return poStatus;
};

const finalize = ({ id, purchaseOrderId }) =>
  prisma.$transaction(async (tx) => {
    const poStatus = await syncPoStatus(purchaseOrderId, tx);

    await tx.purchaseOrderReceipt.update({
      where: { id },
      data: { statusReceipt: 'COMPLETED' },
    });

    return { poStatus };
  });

module.exports = {
  findReceipt,
  getIdentityCoverage,
  getPendingCounts,
  computePoStatus,
  computePoStatusFromItems,
  computeIdentityCoverageFromItems,
  expectedIdentityCountForReceiptItem,
  syncPoStatus,
  finalize,
  isInventoryReceivedRow,
};
