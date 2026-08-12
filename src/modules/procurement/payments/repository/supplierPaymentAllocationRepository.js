'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const createConfirmed = async ({
  branchId,
  supplierId,
  employeeId,
  paidAt,
  method,
  paymentRef,
  note,
  allocations,
}, tx) => {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(28071930::int, ${Number(branchId)}::int)`);
  const payableIds = allocations.map((item) => Number(item.payableId));
  const payables = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "SupplierPayable"
    WHERE "branchId" = ${Number(branchId)}
      AND "supplierId" = ${Number(supplierId)}
      AND "id" IN (${Prisma.join(payableIds)})
      AND "status" IN ('OPEN', 'PARTIALLY_PAID')
    ORDER BY "id"
    FOR UPDATE
  `);
  if (payables.length !== payableIds.length) {
    throw Object.assign(new Error('Some payables are unavailable or no longer open'), {
      code: 'SUPPLIER_PAYMENT_PAYABLE_CONFLICT',
      statusCode: 409,
      isOperational: true,
    });
  }

  const allocationByPayable = new Map(allocations.map((item) => [Number(item.payableId), money(item.amount)]));
  for (const payable of payables) {
    const amount = allocationByPayable.get(Number(payable.id));
    const outstanding = money(Number(payable.totalAmount) - Number(payable.paidAmount));
    if (amount <= 0 || amount > outstanding + 0.01) {
      throw Object.assign(new Error('Allocation exceeds payable outstanding amount'), {
        code: 'SUPPLIER_PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING',
        statusCode: 409,
        isOperational: true,
        details: { payableId: Number(payable.id), amount, outstandingAmount: outstanding },
      });
    }
  }

  const amount = money(allocations.reduce((sum, item) => sum + Number(item.amount), 0));
  const month = new Date(paidAt).toISOString().slice(2, 7).replace('-', '');
  const counts = await tx.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS count FROM "SupplierPayment"
    WHERE "branchId" = ${Number(branchId)}
      AND "createdAt" >= date_trunc('month', CURRENT_TIMESTAMP)
  `);
  const code = `SP-${String(branchId).padStart(2, '0')}${month}-${String(Number(counts[0]?.count || 0) + 1).padStart(4, '0')}`;
  const paymentRows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "SupplierPayment" (
      "supplierId", "method", "note", "paymentRef", "paidAt",
      "employeeId", "branchId", "paymentType", "code", "amount",
      "statusPayment", "lifecycleStatus", "confirmedAt"
    ) VALUES (
      ${Number(supplierId)}, ${method}::"PaymentMethod", ${note || null}, ${paymentRef || null},
      ${new Date(paidAt)}, ${Number(employeeId)}, ${Number(branchId)}, 'RECEIPT_BASED',
      ${code}, ${amount}, 'PAID', 'CONFIRMED', CURRENT_TIMESTAMP
    )
    RETURNING *
  `);
  const payment = paymentRows[0];

  for (const payable of payables) {
    const allocatedAmount = allocationByPayable.get(Number(payable.id));
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "SupplierPaymentAllocation" ("paymentId", "payableId", "amount")
      VALUES (${Number(payment.id)}, ${Number(payable.id)}, ${allocatedAmount})
    `);
    const newPaid = money(Number(payable.paidAmount) + allocatedAmount);
    const newStatus = newPaid >= Number(payable.totalAmount) - 0.01 ? 'PAID' : 'PARTIALLY_PAID';
    await tx.$executeRaw(Prisma.sql`
      UPDATE "SupplierPayable"
      SET
        "paidAmount" = ${newPaid},
        "status" = ${newStatus}::"SupplierPayableStatus",
        "version" = "version" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${Number(payable.id)}
    `);
  }
  return {
    id: Number(payment.id),
    code: payment.code,
    supplierId: Number(payment.supplierId),
    amount,
    method: payment.method,
    paidAt: payment.paidAt,
    lifecycleStatus: payment.lifecycleStatus,
  };
};

const list = async ({ branchId, supplierId = null, limit = 100 }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      payment.*,
      jsonb_build_object('id', supplier."id", 'name', supplier."name") AS supplier,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', allocation."id",
            'payableId', payable."id",
            'payableCode', payable."code",
            'amount', allocation."amount",
            'state', allocation."state"
          )
          ORDER BY allocation."id"
        ) FILTER (WHERE allocation."id" IS NOT NULL),
        '[]'::jsonb
      ) AS allocations
    FROM "SupplierPayment" payment
    JOIN "Supplier" supplier ON supplier."id" = payment."supplierId"
    LEFT JOIN "SupplierPaymentAllocation" allocation ON allocation."paymentId" = payment."id"
    LEFT JOIN "SupplierPayable" payable ON payable."id" = allocation."payableId"
    WHERE payment."branchId" = ${Number(branchId)}
      AND (${supplierId == null ? null : Number(supplierId)}::int IS NULL
        OR payment."supplierId" = ${supplierId == null ? null : Number(supplierId)})
      AND EXISTS (
        SELECT 1 FROM "SupplierPaymentAllocation" authority
        WHERE authority."paymentId" = payment."id"
      )
    GROUP BY payment."id", supplier."id", supplier."name"
    ORDER BY payment."paidAt" DESC, payment."id" DESC
    LIMIT ${Math.min(Math.max(Number(limit) || 100, 1), 200)}
  `);
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    supplierId: Number(row.supplierId),
    amount: money(row.amount),
  }));
};

const voidConfirmed = async ({ branchId, paymentId, employeeId, reason }, tx) => {
  const payments = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "SupplierPayment"
    WHERE "id" = ${Number(paymentId)}
      AND "branchId" = ${Number(branchId)}
    LIMIT 1
    FOR UPDATE
  `);
  const payment = payments[0];
  if (!payment) {
    throw Object.assign(new Error('Supplier payment not found'), {
      code: 'SUPPLIER_PAYMENT_NOT_FOUND',
      statusCode: 404,
      isOperational: true,
    });
  }
  if (payment.lifecycleStatus === 'VOIDED') {
    return { replayed: true, paymentId: Number(payment.id), lifecycleStatus: 'VOIDED' };
  }
  if (payment.lifecycleStatus !== 'CONFIRMED') {
    throw Object.assign(new Error('Only confirmed payments can be voided'), {
      code: 'SUPPLIER_PAYMENT_LIFECYCLE_CONFLICT',
      statusCode: 409,
      isOperational: true,
    });
  }
  const allocations = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "SupplierPaymentAllocation"
    WHERE "paymentId" = ${Number(payment.id)}
      AND "state" = 'ACTIVE'
    ORDER BY "payableId"
    FOR UPDATE
  `);
  if (!allocations.length) {
    throw Object.assign(new Error('Confirmed payment has no active allocations'), {
      code: 'SUPPLIER_PAYMENT_ALLOCATION_MISSING',
      statusCode: 409,
      isOperational: true,
    });
  }

  for (const allocation of allocations) {
    const payables = await tx.$queryRaw(Prisma.sql`
      SELECT * FROM "SupplierPayable"
      WHERE "id" = ${Number(allocation.payableId)}
        AND "branchId" = ${Number(branchId)}
      LIMIT 1
      FOR UPDATE
    `);
    const payable = payables[0];
    if (!payable || payable.status === 'CANCELLED') {
      throw Object.assign(new Error('Allocated payable cannot be reversed'), {
        code: 'SUPPLIER_PAYMENT_REVERSAL_CONFLICT',
        statusCode: 409,
        isOperational: true,
      });
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
    UPDATE "SupplierPaymentAllocation"
    SET "state" = 'REVERSED', "reversedAt" = CURRENT_TIMESTAMP,
        "reversedById" = ${Number(employeeId)}, "reversalReason" = ${reason}
    WHERE "paymentId" = ${Number(payment.id)} AND "state" = 'ACTIVE'
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "SupplierPayment"
    SET "lifecycleStatus" = 'VOIDED', "statusPayment" = 'CANCELLED',
        "voidedAt" = CURRENT_TIMESTAMP, "voidedById" = ${Number(employeeId)},
        "voidReason" = ${reason}, "version" = "version" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(payment.id)}
  `);
  return { replayed: false, paymentId: Number(payment.id), lifecycleStatus: 'VOIDED' };
};

module.exports = Object.freeze({ createConfirmed, list, voidConfirmed });
