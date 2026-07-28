'use strict';

const { prisma, Prisma } = require('../../../../../../lib/prisma');

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const list = async ({ branchId, supplierId = null, asOf }, tx = prisma) => {
  const payables = await tx.$queryRaw(Prisma.sql`
    SELECT
      payable."id",
      payable."supplierId",
      payable."code",
      payable."documentNumber",
      payable."documentDate",
      payable."dueDate",
      payable."totalAmount",
      payable."paidAmount",
      (payable."totalAmount" - payable."paidAmount")::numeric AS "outstandingAmount",
      supplier."name" AS "supplierName",
      CASE
        WHEN payable."dueDate" IS NULL THEN 'NO_DUE_DATE'
        WHEN payable."dueDate"::date >= ${asOf}::date THEN 'NOT_DUE'
        WHEN (${asOf}::date - payable."dueDate"::date) <= 30 THEN 'OVERDUE_1_30'
        WHEN (${asOf}::date - payable."dueDate"::date) <= 60 THEN 'OVERDUE_31_60'
        WHEN (${asOf}::date - payable."dueDate"::date) <= 90 THEN 'OVERDUE_61_90'
        ELSE 'OVERDUE_90_PLUS'
      END AS bucket,
      CASE
        WHEN payable."dueDate" IS NULL OR payable."dueDate"::date >= ${asOf}::date THEN 0
        ELSE (${asOf}::date - payable."dueDate"::date)
      END::int AS "daysOverdue"
    FROM "SupplierPayable" payable
    JOIN "Supplier" supplier ON supplier."id" = payable."supplierId"
    WHERE payable."branchId" = ${Number(branchId)}
      AND payable."status" IN ('OPEN', 'PARTIALLY_PAID')
      AND payable."totalAmount" > payable."paidAmount"
      AND (${supplierId == null ? null : Number(supplierId)}::int IS NULL
        OR payable."supplierId" = ${supplierId == null ? null : Number(supplierId)})
    ORDER BY supplier."name", payable."dueDate" ASC NULLS LAST, payable."id"
  `);

  const advances = await tx.$queryRaw(Prisma.sql`
    SELECT
      advance."supplierId",
      supplier."name" AS "supplierName",
      COALESCE(SUM(advance."availableAmount"), 0)::numeric AS "availableAdvance"
    FROM "SupplierAdvance" advance
    JOIN "Supplier" supplier ON supplier."id" = advance."supplierId"
    WHERE advance."branchId" = ${Number(branchId)}
      AND advance."status" = 'ACTIVE'
      AND advance."availableAmount" > 0
      AND (${supplierId == null ? null : Number(supplierId)}::int IS NULL
        OR advance."supplierId" = ${supplierId == null ? null : Number(supplierId)})
    GROUP BY advance."supplierId", supplier."name"
  `);

  return {
    payables: payables.map((row) => ({
      ...row,
      id: Number(row.id),
      supplierId: Number(row.supplierId),
      totalAmount: money(row.totalAmount),
      paidAmount: money(row.paidAmount),
      outstandingAmount: money(row.outstandingAmount),
      daysOverdue: Number(row.daysOverdue || 0),
    })),
    advances: advances.map((row) => ({
      supplierId: Number(row.supplierId),
      supplierName: row.supplierName,
      availableAdvance: money(row.availableAdvance),
    })),
  };
};

module.exports = Object.freeze({ list });
