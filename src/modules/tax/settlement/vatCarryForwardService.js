'use strict';

const { prisma, Prisma } = require('../../../../lib/prisma');

const fail = (code, message, statusCode = 400, details = undefined) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details) error.details = details;
  throw error;
};

const positiveBranchId = (value) => {
  const branchId = Number(value);
  if (!Number.isInteger(branchId) || branchId <= 0) fail('VAT_CARRY_FORWARD_BRANCH_REQUIRED', 'branchId must be a positive integer');
  return branchId;
};

const positiveActorId = (value) => {
  const actorId = Number(value);
  if (!Number.isInteger(actorId) || actorId <= 0) fail('VAT_CARRY_FORWARD_ACTOR_REQUIRED', 'actorEmployeeId is required');
  return actorId;
};

const periodId = (value) => {
  const id = String(value || '').trim();
  if (!id) fail('VAT_CARRY_FORWARD_PERIOD_REQUIRED', 'taxPeriodId is required');
  return id;
};

const money = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) fail('VAT_CARRY_FORWARD_AMOUNT_INVALID', 'amount must be a non-negative number');
  return parsed.toFixed(2);
};

const sourceType = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!['PRIOR_PERIOD', 'HISTORICAL_OPENING'].includes(normalized)) {
    fail('VAT_CARRY_FORWARD_SOURCE_TYPE_INVALID', 'sourceType must be PRIOR_PERIOD or HISTORICAL_OPENING');
  }
  return normalized;
};

const loadPeriodContext = async ({ branchId, taxPeriodId }, tx = prisma, lock = false) => {
  const lockSql = lock ? Prisma.sql`FOR UPDATE` : Prisma.empty;
  const targets = await tx.$queryRaw(Prisma.sql`
    SELECT "id", "branchId", "periodCode", "startDate", "endDate", "status"
    FROM "TaxPeriod"
    WHERE "id" = ${taxPeriodId}
      AND "branchId" = ${branchId}
    LIMIT 1
    ${lockSql}
  `);
  const target = targets[0] || null;
  if (!target) fail('VAT_CARRY_FORWARD_PERIOD_NOT_FOUND', 'Tax period was not found', 404);

  const previousRows = await tx.$queryRaw(Prisma.sql`
    SELECT "id", "periodCode", "startDate", "endDate", "status"
    FROM "TaxPeriod"
    WHERE "branchId" = ${branchId}
      AND "endDate" < ${target.startDate}
    ORDER BY "endDate" DESC
    LIMIT 1
  `);
  return { target, previousPeriod: previousRows[0] || null };
};

const loadVatCarryForwardAuthority = async ({ branchId, taxPeriodId }, tx = prisma) => {
  const normalizedBranchId = positiveBranchId(branchId);
  const normalizedPeriodId = periodId(taxPeriodId);
  const context = await loadPeriodContext({ branchId: normalizedBranchId, taxPeriodId: normalizedPeriodId }, tx);
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "VatCarryForwardAuthority"
    WHERE "branchId" = ${normalizedBranchId}
      AND "taxPeriodId" = ${normalizedPeriodId}
    LIMIT 1
  `);
  const authority = rows[0] || null;
  return Object.freeze({
    branchId: normalizedBranchId,
    period: context.target,
    previousPeriod: context.previousPeriod,
    authority: authority ? Object.freeze({
      ...authority,
      amount: Number(authority.amount || 0),
      version: Number(authority.version || 1),
    }) : null,
    required: Boolean(context.previousPeriod),
  });
};

const confirmVatCarryForwardAuthority = async ({
  branchId,
  taxPeriodId,
  sourceType: requestedSourceType,
  amount,
  note,
  actorEmployeeId,
}) => prisma.$transaction(async (tx) => {
  const normalizedBranchId = positiveBranchId(branchId);
  const normalizedPeriodId = periodId(taxPeriodId);
  const normalizedSourceType = sourceType(requestedSourceType);
  const normalizedAmount = money(amount);
  const normalizedActorId = positiveActorId(actorEmployeeId);
  const normalizedNote = String(note || '').trim() || null;

  const { target, previousPeriod } = await loadPeriodContext({
    branchId: normalizedBranchId,
    taxPeriodId: normalizedPeriodId,
  }, tx, true);

  if (['LOCKED', 'SUBMITTED'].includes(String(target.status))) {
    fail('VAT_CARRY_FORWARD_PERIOD_IMMUTABLE', 'Carry-forward authority cannot change after the tax period is locked', 409, {
      taxPeriodId: target.id,
      taxPeriodStatus: target.status,
    });
  }

  let sourceTaxPeriodId = null;
  if (normalizedSourceType === 'PRIOR_PERIOD') {
    if (!previousPeriod) fail('VAT_CARRY_FORWARD_PREVIOUS_PERIOD_REQUIRED', 'A prior tax period is required for PRIOR_PERIOD authority', 409);
    if (!['LOCKED', 'SUBMITTED'].includes(String(previousPeriod.status))) {
      fail('VAT_CARRY_FORWARD_PREVIOUS_PERIOD_NOT_FINALIZED', 'Prior tax period must be locked or submitted before its VAT credit is carried forward', 409, {
        previousPeriodId: previousPeriod.id,
        previousPeriodStatus: previousPeriod.status,
      });
    }
    sourceTaxPeriodId = previousPeriod.id;
  } else if (previousPeriod) {
    fail('VAT_CARRY_FORWARD_HISTORICAL_OPENING_NOT_ALLOWED', 'Historical opening authority is only allowed when no prior tax period exists', 409, {
      previousPeriodId: previousPeriod.id,
    });
  }

  const sourceSnapshot = {
    sourceType: normalizedSourceType,
    sourceTaxPeriodId,
    sourcePeriodCode: previousPeriod?.periodCode || null,
    sourcePeriodStatus: previousPeriod?.status || null,
    confirmedAmount: normalizedAmount,
    confirmedById: normalizedActorId,
  };

  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "VatCarryForwardAuthority" (
      "id", "branchId", "taxPeriodId", "sourceTaxPeriodId", "sourceType", "amount",
      "status", "note", "sourceSnapshot", "version", "confirmedById", "confirmedAt", "createdAt", "updatedAt"
    ) VALUES (
      CONCAT('vcf_', md5(random()::text || clock_timestamp()::text)),
      ${normalizedBranchId}, ${normalizedPeriodId}, ${sourceTaxPeriodId},
      ${normalizedSourceType}::"VatCarryForwardSourceType", ${normalizedAmount},
      'CONFIRMED'::"VatCarryForwardStatus", ${normalizedNote}, ${JSON.stringify(sourceSnapshot)}::jsonb,
      1, ${normalizedActorId}, NOW(), NOW(), NOW()
    )
    ON CONFLICT ("branchId", "taxPeriodId") DO UPDATE SET
      "sourceTaxPeriodId" = EXCLUDED."sourceTaxPeriodId",
      "sourceType" = EXCLUDED."sourceType",
      "amount" = EXCLUDED."amount",
      "status" = 'CONFIRMED'::"VatCarryForwardStatus",
      "note" = EXCLUDED."note",
      "sourceSnapshot" = EXCLUDED."sourceSnapshot",
      "version" = "VatCarryForwardAuthority"."version" + 1,
      "confirmedById" = EXCLUDED."confirmedById",
      "confirmedAt" = NOW(),
      "updatedAt" = NOW()
    RETURNING *
  `);

  const authority = rows[0];
  return Object.freeze({
    ...authority,
    amount: Number(authority.amount || 0),
    version: Number(authority.version || 1),
  });
});

module.exports = Object.freeze({
  loadVatCarryForwardAuthority,
  confirmVatCarryForwardAuthority,
});
