const { prisma } = require('../../../../../lib/prisma');

const findAuditSession = ({ sessionId, client = prisma }) => client.stockAuditSession.findUnique({
  where: { id: sessionId },
  select: { id: true, branchId: true, status: true, mode: true, confirmedAt: true },
});

const findEmployeeId = async ({ userId, employeeId, client = prisma }) => {
  if (employeeId) return employeeId;
  if (!userId) return null;
  const employee = await client.employeeProfile.findFirst({
    where: { userId },
    select: { id: true },
  });
  return employee?.id ?? null;
};

const scanBarcodeTransaction = ({ sessionId, barcode, employeeId, client = prisma }) => client.$transaction(async (tx) => {
  const snapshot = await tx.stockAuditSnapshotItem.findFirst({
    where: { auditSessionId: sessionId, barcode },
    select: { id: true, isScanned: true, stockItemId: true },
  });
  if (!snapshot) return { status: 422, reason: 'NOT_IN_EXPECTED_SET' };
  if (snapshot.isScanned) return { status: 409, reason: 'DUPLICATE_SCAN' };

  const updated = await tx.stockAuditSnapshotItem.updateMany({
    where: { id: snapshot.id, isScanned: false },
    data: { isScanned: true, scannedAt: new Date() },
  });
  if (updated.count !== 1) return { status: 409, reason: 'DUPLICATE_SCAN' };

  const stockItem = await tx.stockItem.findUnique({
    where: { id: snapshot.stockItemId },
    select: { id: true, barcode: true },
  });
  if (!stockItem) return { status: 500, reason: 'STOCK_ITEM_NOT_FOUND' };

  await tx.stockAuditScanLog.create({
    data: { auditSessionId: sessionId, stockItemId: stockItem.id, barcode: stockItem.barcode, byEmployeeId: employeeId },
  });
  await tx.stockAuditSession.update({
    where: { id: sessionId },
    data: { scannedCount: { increment: 1 } },
  });
  return { status: 200 };
});

const scanSerialTransaction = ({ sessionId, branchId, serialNumber, employeeId, client = prisma }) => client.$transaction(async (tx) => {
  const stockItem = await tx.stockItem.findFirst({
    where: { branchId, status: 'IN_STOCK', serialNumber },
    select: { id: true, barcode: true },
  });
  if (!stockItem) return { status: 422, reason: 'SN_NOT_FOUND' };

  const snapshot = await tx.stockAuditSnapshotItem.findFirst({
    where: { auditSessionId: sessionId, stockItemId: stockItem.id },
    select: { id: true, isScanned: true },
  });
  if (!snapshot) return { status: 422, reason: 'NOT_IN_EXPECTED_SET' };
  if (snapshot.isScanned) return { status: 409, reason: 'DUPLICATE_SCAN' };

  const updated = await tx.stockAuditSnapshotItem.updateMany({
    where: { id: snapshot.id, isScanned: false },
    data: { isScanned: true, scannedAt: new Date() },
  });
  if (updated.count !== 1) return { status: 409, reason: 'DUPLICATE_SCAN' };

  await tx.stockAuditScanLog.create({
    data: { auditSessionId: sessionId, stockItemId: stockItem.id, barcode: stockItem.barcode, byEmployeeId: employeeId },
  });
  await tx.stockAuditSession.update({
    where: { id: sessionId },
    data: { scannedCount: { increment: 1 } },
  });
  return { status: 200 };
});

module.exports = { findAuditSession, findEmployeeId, scanBarcodeTransaction, scanSerialTransaction };
