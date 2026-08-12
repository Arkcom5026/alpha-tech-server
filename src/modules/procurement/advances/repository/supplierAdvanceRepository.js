'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const fail = (message, code, statusCode = 409, details) => {
  throw Object.assign(new Error(message), { code, statusCode, isOperational: true, details });
};

const list = async ({ branchId, supplierId = null, status = null, limit = 100 }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      advance.*,
      jsonb_build_object('id', supplier."id", 'name', supplier."name") AS supplier,
      jsonb_build_object(
        'id', payment."id", 'method', payment."method",
        'paidAt', payment."paidAt", 'paymentRef', payment."paymentRef",
        'lifecycleStatus', payment."lifecycleStatus"
      ) AS payment,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', allocation."id", 'payableId', payable."id",
            'payableCode', payable."code", 'amount', allocation."amount",
            'state', allocation."state"
          ) ORDER BY allocation."id"
        ) FILTER (WHERE allocation."id" IS NOT NULL),
        '[]'::jsonb
      ) AS allocations
    FROM "SupplierAdvance" advance
    JOIN "Supplier" supplier ON supplier."id" = advance."supplierId"
    JOIN "SupplierPayment" payment ON payment."id" = advance."paymentId"
    LEFT JOIN "SupplierAdvanceAllocation" allocation ON allocation."advanceId" = advance."id"
    LEFT JOIN "SupplierPayable" payable ON payable."id" = allocation."payableId"
    WHERE advance."branchId" = ${Number(branchId)}
      AND (${supplierId == null ? null : Number(supplierId)}::int IS NULL
        OR advance."supplierId" = ${supplierId == null ? null : Number(supplierId)})
      AND (${status || null}::text IS NULL OR advance."status"::text = ${status || null})
    GROUP BY advance."id", supplier."id", supplier."name", payment."id"
    ORDER BY advance."createdAt" DESC, advance."id" DESC
    LIMIT ${Math.min(Math.max(Number(limit) || 100, 1), 200)}
  `);
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    branchId: Number(row.branchId),
    supplierId: Number(row.supplierId),
    paymentId: Number(row.paymentId),
    originalAmount: money(row.originalAmount),
    availableAmount: money(row.availableAmount),
    usedAmount: money(Number(row.originalAmount) - Number(row.availableAmount)),
  }));
};

const create = async ({
  branchId, supplierId, employeeId, paidAt, method, paymentRef, note, amount,
}, tx) => {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(28072030::int, ${Number(branchId)}::int)`);
  const suppliers = await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "Supplier"
    WHERE "id" = ${Number(supplierId)} AND "branchId" = ${Number(branchId)} AND "active" = true
    LIMIT 1
  `);
  if (!suppliers.length) fail('Supplier not found in this branch', 'SUPPLIER_ADVANCE_SUPPLIER_NOT_FOUND', 404);

  const month = new Date(paidAt).toISOString().slice(2, 7).replace('-', '');
  const counts = await tx.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS count FROM "SupplierAdvance"
    WHERE "branchId" = ${Number(branchId)}
      AND "createdAt" >= date_trunc('month', CURRENT_TIMESTAMP)
  `);
  const sequence = String(Number(counts[0]?.count || 0) + 1).padStart(4, '0');
  const paymentCode = `SP-${String(branchId).padStart(2, '0')}${month}-A${sequence}`;
  const advanceCode = `SA-${String(branchId).padStart(2, '0')}${month}-${sequence}`;
  const payments = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "SupplierPayment" (
      "supplierId", "method", "note", "paymentRef", "paidAt", "employeeId",
      "branchId", "paymentType", "code", "amount", "statusPayment",
      "lifecycleStatus", "confirmedAt"
    ) VALUES (
      ${Number(supplierId)}, ${method}::"PaymentMethod", ${note || null}, ${paymentRef || null},
      ${new Date(paidAt)}, ${Number(employeeId)}, ${Number(branchId)}, 'ADVANCE',
      ${paymentCode}, ${money(amount)}, 'PAID', 'CONFIRMED', CURRENT_TIMESTAMP
    )
    RETURNING *
  `);
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "SupplierAdvance" (
      "branchId", "supplierId", "paymentId", "code", "status",
      "originalAmount", "availableAmount", "createdById", "activatedAt", "activatedById"
    ) VALUES (
      ${Number(branchId)}, ${Number(supplierId)}, ${Number(payments[0].id)}, ${advanceCode},
      'ACTIVE', ${money(amount)}, ${money(amount)}, ${Number(employeeId)},
      CURRENT_TIMESTAMP, ${Number(employeeId)}
    )
    RETURNING *
  `);
  return {
    ...rows[0],
    id: Number(rows[0].id),
    supplierId: Number(rows[0].supplierId),
    paymentId: Number(rows[0].paymentId),
    originalAmount: money(rows[0].originalAmount),
    availableAmount: money(rows[0].availableAmount),
  };
};

const activateLegacy = async ({ branchId, advanceId, employeeId, availableAmount }, tx) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "SupplierAdvance"
    WHERE "id" = ${Number(advanceId)} AND "branchId" = ${Number(branchId)}
    LIMIT 1 FOR UPDATE
  `);
  const advance = rows[0];
  if (!advance) fail('Supplier advance not found', 'SUPPLIER_ADVANCE_NOT_FOUND', 404);
  if (advance.status !== 'REVIEW_REQUIRED') {
    fail('Only imported advances awaiting review can be activated', 'SUPPLIER_ADVANCE_REVIEW_CONFLICT');
  }
  const confirmedAvailable = money(availableAmount);
  if (confirmedAvailable <= 0 || confirmedAvailable > Number(advance.originalAmount) + 0.01) {
    fail('Confirmed available amount is invalid', 'SUPPLIER_ADVANCE_AVAILABLE_INVALID', 400);
  }
  const updated = await tx.$queryRaw(Prisma.sql`
    UPDATE "SupplierAdvance"
    SET "availableAmount" = ${confirmedAvailable}, "status" = 'ACTIVE',
        "activatedAt" = CURRENT_TIMESTAMP, "activatedById" = ${Number(employeeId)},
        "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(advance.id)}
    RETURNING *
  `);
  return { id: Number(updated[0].id), status: updated[0].status, availableAmount: confirmedAvailable };
};

const apply = async ({ branchId, advanceId, supplierId, allocations }, tx) => {
  const advances = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "SupplierAdvance"
    WHERE "id" = ${Number(advanceId)} AND "branchId" = ${Number(branchId)}
      AND "supplierId" = ${Number(supplierId)}
    LIMIT 1 FOR UPDATE
  `);
  const advance = advances[0];
  if (!advance) fail('Supplier advance not found', 'SUPPLIER_ADVANCE_NOT_FOUND', 404);
  if (advance.status !== 'ACTIVE') fail('Supplier advance is not available', 'SUPPLIER_ADVANCE_NOT_ACTIVE');

  const payableIds = allocations.map((item) => Number(item.payableId));
  const payables = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "SupplierPayable"
    WHERE "id" IN (${Prisma.join(payableIds)})
      AND "branchId" = ${Number(branchId)}
      AND "supplierId" = ${Number(supplierId)}
      AND "status" IN ('OPEN', 'PARTIALLY_PAID')
    ORDER BY "id" FOR UPDATE
  `);
  if (payables.length !== payableIds.length) {
    fail('Some payables are unavailable or no longer open', 'SUPPLIER_ADVANCE_PAYABLE_CONFLICT');
  }
  const allocationMap = new Map(allocations.map((item) => [Number(item.payableId), money(item.amount)]));
  const totalApplied = money(allocations.reduce((sum, item) => sum + Number(item.amount), 0));
  if (totalApplied > Number(advance.availableAmount) + 0.01) {
    fail('Advance allocation exceeds available credit', 'SUPPLIER_ADVANCE_EXCEEDS_AVAILABLE', 409, {
      availableAmount: money(advance.availableAmount),
      requestedAmount: totalApplied,
    });
  }
  for (const payable of payables) {
    const allocated = allocationMap.get(Number(payable.id));
    const outstanding = money(Number(payable.totalAmount) - Number(payable.paidAmount));
    if (allocated <= 0 || allocated > outstanding + 0.01) {
      fail('Advance allocation exceeds payable outstanding', 'SUPPLIER_ADVANCE_EXCEEDS_OUTSTANDING', 409, {
        payableId: Number(payable.id), outstandingAmount: outstanding,
      });
    }
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "SupplierAdvanceAllocation" ("advanceId", "payableId", "amount")
      VALUES (${Number(advance.id)}, ${Number(payable.id)}, ${allocated})
    `);
    const newPaid = money(Number(payable.paidAmount) + allocated);
    const newStatus = newPaid >= Number(payable.totalAmount) - 0.01 ? 'PAID' : 'PARTIALLY_PAID';
    await tx.$executeRaw(Prisma.sql`
      UPDATE "SupplierPayable"
      SET "paidAmount" = ${newPaid}, "status" = ${newStatus}::"SupplierPayableStatus",
          "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${Number(payable.id)}
    `);
  }
  const available = money(Number(advance.availableAmount) - totalApplied);
  const status = available <= 0.01 ? 'EXHAUSTED' : 'ACTIVE';
  await tx.$executeRaw(Prisma.sql`
    UPDATE "SupplierAdvance"
    SET "availableAmount" = ${available}, "status" = ${status}::"SupplierAdvanceStatus",
        "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(advance.id)}
  `);
  return { advanceId: Number(advance.id), appliedAmount: totalApplied, availableAmount: available, status };
};

const voidAdvance = async ({ branchId, advanceId, employeeId, reason }, tx) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "SupplierAdvance"
    WHERE "id" = ${Number(advanceId)} AND "branchId" = ${Number(branchId)}
    LIMIT 1 FOR UPDATE
  `);
  const advance = rows[0];
  if (!advance) fail('Supplier advance not found', 'SUPPLIER_ADVANCE_NOT_FOUND', 404);
  if (advance.status === 'VOIDED') return { replayed: true, advanceId: Number(advance.id), status: 'VOIDED' };

  const allocations = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "SupplierAdvanceAllocation"
    WHERE "advanceId" = ${Number(advance.id)} AND "state" = 'ACTIVE'
    ORDER BY "payableId" FOR UPDATE
  `);
  for (const allocation of allocations) {
    const payables = await tx.$queryRaw(Prisma.sql`
      SELECT * FROM "SupplierPayable"
      WHERE "id" = ${Number(allocation.payableId)} AND "branchId" = ${Number(branchId)}
      LIMIT 1 FOR UPDATE
    `);
    const payable = payables[0];
    if (!payable || payable.status === 'CANCELLED') {
      fail('Allocated payable cannot be reversed', 'SUPPLIER_ADVANCE_REVERSAL_CONFLICT');
    }
    const newPaid = money(Math.max(0, Number(payable.paidAmount) - Number(allocation.amount)));
    const newStatus = newPaid <= 0.01 ? 'OPEN'
      : newPaid >= Number(payable.totalAmount) - 0.01 ? 'PAID' : 'PARTIALLY_PAID';
    await tx.$executeRaw(Prisma.sql`
      UPDATE "SupplierPayable"
      SET "paidAmount" = ${newPaid}, "status" = ${newStatus}::"SupplierPayableStatus",
          "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${Number(payable.id)}
    `);
  }
  await tx.$executeRaw(Prisma.sql`
    UPDATE "SupplierAdvanceAllocation"
    SET "state" = 'REVERSED', "reversedAt" = CURRENT_TIMESTAMP,
        "reversedById" = ${Number(employeeId)}, "reversalReason" = ${reason}
    WHERE "advanceId" = ${Number(advance.id)} AND "state" = 'ACTIVE'
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "SupplierAdvance"
    SET "status" = 'VOIDED', "availableAmount" = 0, "voidedAt" = CURRENT_TIMESTAMP,
        "voidedById" = ${Number(employeeId)}, "voidReason" = ${reason},
        "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(advance.id)}
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "SupplierPayment"
    SET "lifecycleStatus" = 'VOIDED', "statusPayment" = 'CANCELLED',
        "voidedAt" = CURRENT_TIMESTAMP, "voidedById" = ${Number(employeeId)},
        "voidReason" = ${reason}, "version" = "version" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(advance.paymentId)}
  `);
  return { replayed: false, advanceId: Number(advance.id), status: 'VOIDED' };
};

module.exports = Object.freeze({ activateLegacy, apply, create, list, voidAdvance });
