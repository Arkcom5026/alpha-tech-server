'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const fail = (message, code, statusCode = 409) => {
  throw Object.assign(new Error(message), { code, statusCode, isOperational: true });
};

const getPayableForUpdate = async (tx, branchId, payableId) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "SupplierPayable"
    WHERE "id" = ${Number(payableId)} AND "branchId" = ${Number(branchId)}
    LIMIT 1 FOR UPDATE
  `);
  if (!rows.length) fail('Supplier payable not found', 'SUPPLIER_PAYABLE_NOT_FOUND', 404);
  return rows[0];
};

const normalStatus = (payable) => Number(payable.paidAmount) >= Number(payable.totalAmount) - 0.01
  ? 'PAID'
  : Number(payable.paidAmount) > 0 ? 'PARTIALLY_PAID' : 'OPEN';

const list = async ({ branchId, payableId = null }, tx = prisma) => {
  const disputes = await tx.$queryRaw(Prisma.sql`
    SELECT dispute.*, payable."code" AS "payableCode", supplier."name" AS "supplierName"
    FROM "SupplierPayableDispute" dispute
    JOIN "SupplierPayable" payable ON payable."id" = dispute."payableId"
    JOIN "Supplier" supplier ON supplier."id" = dispute."supplierId"
    WHERE dispute."branchId" = ${Number(branchId)}
      AND (${payableId == null ? null : Number(payableId)}::int IS NULL
        OR dispute."payableId" = ${payableId == null ? null : Number(payableId)})
    ORDER BY dispute."openedAt" DESC, dispute."id" DESC
  `);
  const adjustments = await tx.$queryRaw(Prisma.sql`
    SELECT adjustment.*, payable."code" AS "payableCode", supplier."name" AS "supplierName"
    FROM "SupplierPayableAdjustment" adjustment
    JOIN "SupplierPayable" payable ON payable."id" = adjustment."payableId"
    JOIN "Supplier" supplier ON supplier."id" = adjustment."supplierId"
    WHERE adjustment."branchId" = ${Number(branchId)}
      AND (${payableId == null ? null : Number(payableId)}::int IS NULL
        OR adjustment."payableId" = ${payableId == null ? null : Number(payableId)})
    ORDER BY adjustment."confirmedAt" DESC, adjustment."id" DESC
  `);
  return {
    disputes: disputes.map((row) => ({ ...row, id: Number(row.id), payableId: Number(row.payableId), disputedAmount: money(row.disputedAmount) })),
    adjustments: adjustments.map((row) => ({ ...row, id: Number(row.id), payableId: Number(row.payableId), amount: money(row.amount) })),
  };
};

const open = async ({ branchId, payableId, employeeId, disputedAmount, reason }, tx) => {
  const payable = await getPayableForUpdate(tx, branchId, payableId);
  if (['PAID', 'CANCELLED'].includes(payable.status)) {
    fail('Paid or cancelled payable cannot be disputed', 'SUPPLIER_DISPUTE_PAYABLE_CONFLICT');
  }
  const existing = await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "SupplierPayableDispute"
    WHERE "payableId" = ${Number(payableId)} AND "status" = 'OPEN'
    LIMIT 1
  `);
  if (existing.length) fail('Payable already has an open dispute', 'SUPPLIER_DISPUTE_ALREADY_OPEN');
  const outstanding = money(Number(payable.totalAmount) - Number(payable.paidAmount));
  if (disputedAmount > outstanding + 0.01) fail('Disputed amount exceeds outstanding', 'SUPPLIER_DISPUTE_EXCEEDS_OUTSTANDING');
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "SupplierPayableDispute" (
      "branchId", "supplierId", "payableId", "disputedAmount", "reason", "openedById"
    ) VALUES (
      ${Number(branchId)}, ${Number(payable.supplierId)}, ${Number(payableId)},
      ${money(disputedAmount)}, ${reason}, ${Number(employeeId)}
    ) RETURNING *
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "SupplierPayable"
    SET "status" = 'DISPUTED', "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(payableId)}
  `);
  return { ...rows[0], id: Number(rows[0].id), payableId: Number(rows[0].payableId), disputedAmount: money(rows[0].disputedAmount) };
};

const createAdjustment = async ({
  branchId, payableId, disputeId = null, employeeId, type, direction,
  amount, documentNumber, documentDate, note,
}, tx) => {
  const payable = await getPayableForUpdate(tx, branchId, payableId);
  if (payable.status === 'CANCELLED') fail('Cancelled payable cannot be adjusted', 'SUPPLIER_ADJUSTMENT_PAYABLE_CONFLICT');
  if (disputeId) {
    const disputes = await tx.$queryRaw(Prisma.sql`
      SELECT * FROM "SupplierPayableDispute"
      WHERE "id" = ${Number(disputeId)} AND "payableId" = ${Number(payableId)}
        AND "branchId" = ${Number(branchId)} AND "status" = 'OPEN'
      LIMIT 1 FOR UPDATE
    `);
    if (!disputes.length) fail('Open dispute not found', 'SUPPLIER_DISPUTE_NOT_OPEN', 404);
  }
  const nextTotal = money(Number(payable.totalAmount) + (direction === 'CREDIT' ? -amount : amount));
  if (nextTotal < Number(payable.paidAmount) - 0.01 || nextTotal < 0) {
    fail('Credit adjustment exceeds unpaid payable balance', 'SUPPLIER_ADJUSTMENT_EXCEEDS_BALANCE');
  }
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(28072130::int, ${Number(branchId)}::int)`);
  const countRows = await tx.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS count FROM "SupplierPayableAdjustment"
    WHERE "branchId" = ${Number(branchId)} AND "createdAt" >= date_trunc('month', CURRENT_TIMESTAMP)
  `);
  const month = new Date().toISOString().slice(2, 7).replace('-', '');
  const code = `PAJ-${String(branchId).padStart(2, '0')}${month}-${String(Number(countRows[0]?.count || 0) + 1).padStart(4, '0')}`;
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "SupplierPayableAdjustment" (
      "branchId", "supplierId", "payableId", "disputeId", "code", "type",
      "direction", "amount", "documentNumber", "documentDate", "note", "createdById"
    ) VALUES (
      ${Number(branchId)}, ${Number(payable.supplierId)}, ${Number(payableId)},
      ${disputeId ? Number(disputeId) : null}, ${code},
      ${type}::"SupplierPayableAdjustmentType", ${direction}::"SupplierPayableAdjustmentDirection",
      ${money(amount)}, ${documentNumber || null}, ${documentDate || null}, ${note || null}, ${Number(employeeId)}
    ) RETURNING *
  `);
  const projected = { ...payable, totalAmount: nextTotal };
  await tx.$executeRaw(Prisma.sql`
    UPDATE "SupplierPayable"
    SET "totalAmount" = ${nextTotal}, "status" = ${disputeId || payable.status === 'DISPUTED' ? 'DISPUTED' : normalStatus(projected)}::"SupplierPayableStatus",
        "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(payableId)}
  `);
  return { ...rows[0], id: Number(rows[0].id), payableId: Number(rows[0].payableId), amount: money(rows[0].amount) };
};

const resolve = async ({ branchId, disputeId, employeeId, resolutionNote, adjustment }, tx) => {
  const disputes = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "SupplierPayableDispute"
    WHERE "id" = ${Number(disputeId)} AND "branchId" = ${Number(branchId)}
    LIMIT 1 FOR UPDATE
  `);
  const dispute = disputes[0];
  if (!dispute) fail('Supplier dispute not found', 'SUPPLIER_DISPUTE_NOT_FOUND', 404);
  if (dispute.status !== 'OPEN') fail('Supplier dispute is no longer open', 'SUPPLIER_DISPUTE_NOT_OPEN');
  let createdAdjustment = null;
  if (adjustment) {
    createdAdjustment = await createAdjustment({
      ...adjustment, branchId, payableId: Number(dispute.payableId),
      disputeId: Number(dispute.id), employeeId,
    }, tx);
  }
  const payable = await getPayableForUpdate(tx, branchId, dispute.payableId);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "SupplierPayableDispute"
    SET "status" = 'RESOLVED', "resolvedById" = ${Number(employeeId)},
        "resolvedAt" = CURRENT_TIMESTAMP, "resolutionNote" = ${resolutionNote},
        "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(dispute.id)}
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "SupplierPayable"
    SET "status" = ${normalStatus(payable)}::"SupplierPayableStatus",
        "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(payable.id)}
  `);
  return { disputeId: Number(dispute.id), status: 'RESOLVED', adjustment: createdAdjustment };
};

const voidAdjustment = async ({ branchId, adjustmentId, employeeId, reason }, tx) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "SupplierPayableAdjustment"
    WHERE "id" = ${Number(adjustmentId)} AND "branchId" = ${Number(branchId)}
    LIMIT 1 FOR UPDATE
  `);
  const adjustment = rows[0];
  if (!adjustment) fail('Supplier adjustment not found', 'SUPPLIER_ADJUSTMENT_NOT_FOUND', 404);
  if (adjustment.status === 'VOIDED') return { replayed: true, adjustmentId: Number(adjustment.id), status: 'VOIDED' };
  const payable = await getPayableForUpdate(tx, branchId, adjustment.payableId);
  const restoredTotal = money(Number(payable.totalAmount) + (adjustment.direction === 'CREDIT' ? Number(adjustment.amount) : -Number(adjustment.amount)));
  if (restoredTotal < Number(payable.paidAmount) - 0.01 || restoredTotal < 0) {
    fail('Adjustment reversal conflicts with payments already made', 'SUPPLIER_ADJUSTMENT_REVERSAL_CONFLICT');
  }
  const openDisputes = await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "SupplierPayableDispute"
    WHERE "payableId" = ${Number(payable.id)} AND "status" = 'OPEN' LIMIT 1
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "SupplierPayableAdjustment"
    SET "status" = 'VOIDED', "voidedById" = ${Number(employeeId)},
        "voidedAt" = CURRENT_TIMESTAMP, "voidReason" = ${reason},
        "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(adjustment.id)}
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "SupplierPayable"
    SET "totalAmount" = ${restoredTotal},
        "status" = ${openDisputes.length ? 'DISPUTED' : normalStatus({ ...payable, totalAmount: restoredTotal })}::"SupplierPayableStatus",
        "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(payable.id)}
  `);
  return { replayed: false, adjustmentId: Number(adjustment.id), status: 'VOIDED' };
};

module.exports = Object.freeze({ createAdjustment, list, open, resolve, voidAdjustment });
