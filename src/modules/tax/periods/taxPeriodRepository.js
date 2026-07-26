const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../../../lib/prisma');

const STATUS_VALUES = ['OPEN', 'CLOSED', 'LOCKED', 'SUBMITTED', 'REOPENED'];

const mapRow = (row) => ({
  ...row,
  responseVersion: 1,
  availableActions: getAvailableActions(row.status),
});

const getAvailableActions = (status) => {
  const transitions = {
    OPEN: ['CLOSE'],
    REOPENED: ['CLOSE'],
    CLOSED: ['LOCK', 'REOPEN'],
    LOCKED: ['SUBMIT', 'REOPEN'],
    SUBMITTED: ['REOPEN'],
  };
  return (transitions[status] || []).map((action) => ({ action }));
};

const findById = async ({ taxPeriodId, branchId }) => {
  const rows = await prisma.$queryRaw`
    SELECT * FROM "TaxPeriod"
    WHERE "id" = ${String(taxPeriodId)} AND "branchId" = ${Number(branchId)}
    LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
};

const list = async ({ branchId, status, fromDate, toDate }) => {
  const filters = [Prisma.sql`"branchId" = ${Number(branchId)}`];
  if (status) filters.push(Prisma.sql`"status" = ${status}::"TaxPeriodStatus"`);
  if (fromDate) filters.push(Prisma.sql`"endDate" >= ${new Date(fromDate)}`);
  if (toDate) filters.push(Prisma.sql`"startDate" <= ${new Date(toDate)}`);

  const rows = await prisma.$queryRaw(
    Prisma.sql`SELECT * FROM "TaxPeriod" WHERE ${Prisma.join(filters, ' AND ')} ORDER BY "startDate" DESC`,
  );
  return rows.map(mapRow);
};

const createMonthly = async ({ branchId, periodCode, startDate, endDate }) => {
  const id = crypto.randomUUID();
  const rows = await prisma.$queryRaw`
    INSERT INTO "TaxPeriod" (
      "id", "branchId", "periodCode", "startDate", "endDate", "status", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${Number(branchId)}, ${periodCode}, ${startDate}, ${endDate}, 'OPEN'::"TaxPeriodStatus", NOW(), NOW()
    )
    ON CONFLICT ("branchId", "periodCode") DO UPDATE SET "updatedAt" = "TaxPeriod"."updatedAt"
    RETURNING *
  `;
  return mapRow(rows[0]);
};

const transition = async ({ taxPeriodId, branchId, targetStatus, occurredAt }) => {
  const timestamp = occurredAt ? new Date(occurredAt) : new Date();
  const fieldByStatus = {
    CLOSED: 'closedAt',
    LOCKED: 'lockedAt',
    SUBMITTED: 'submittedAt',
    REOPENED: 'reopenedAt',
  };
  const field = fieldByStatus[targetStatus];
  if (!field || !STATUS_VALUES.includes(targetStatus)) throw new Error('Unsupported tax period transition');

  const rows = await prisma.$queryRawUnsafe(
    `UPDATE "TaxPeriod" SET "status" = $1::"TaxPeriodStatus", "${field}" = $2, "updatedAt" = NOW() WHERE "id" = $3 AND "branchId" = $4 RETURNING *`,
    targetStatus,
    timestamp,
    String(taxPeriodId),
    Number(branchId),
  );
  return rows[0] ? mapRow(rows[0]) : null;
};

module.exports = {
  STATUS_VALUES,
  createMonthly,
  findById,
  getAvailableActions,
  list,
  transition,
};