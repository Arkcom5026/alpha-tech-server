'use strict';

const { prisma, Prisma } = require('../../../../lib/prisma');

const fail = (code, message, statusCode = 400, details = undefined) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details) error.details = details;
  throw error;
};

const positiveInt = (value, code, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(code, `${label} must be a positive integer`);
  return parsed;
};

const requiredPeriodId = (value) => {
  const id = String(value || '').trim();
  if (!id) fail('WHT_PERIOD_REQUIRED', 'taxPeriodId is required');
  return id;
};

const normalizeFormType = (value) => {
  const formType = String(value || '').trim().toUpperCase();
  if (!['PND3', 'PND53'].includes(formType)) fail('WHT_FORM_TYPE_INVALID', 'formType must be PND3 or PND53');
  return formType;
};

const actorId = (value) => positiveInt(value, 'WHT_ACTOR_REQUIRED', 'actorEmployeeId');
const money = (value) => Number(value || 0);

const loadPeriod = async ({ branchId, taxPeriodId }, tx = prisma, lock = false) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT "id", "branchId", "periodCode", "startDate", "endDate", "status"
    FROM "TaxPeriod"
    WHERE "id" = ${taxPeriodId}
      AND "branchId" = ${branchId}
    LIMIT 1
    ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}
  `);
  if (!rows[0]) fail('WHT_PERIOD_NOT_FOUND', 'Tax period was not found', 404);
  return rows[0];
};

const expectedFormForPayee = (payeeType) => {
  if (payeeType === 'INDIVIDUAL') return 'PND3';
  if (payeeType === 'LEGAL_ENTITY') return 'PND53';
  return null;
};

const buildExceptions = ({ sourceRows, batches }) => {
  const count = (predicate) => sourceRows.filter(predicate).length;
  const exceptions = [];
  const pending = count((row) => row.whtTreatment === 'PENDING_REVIEW');
  const required = count((row) => row.whtTreatment === 'WITHHOLDING_REQUIRED');
  const withheldWithoutCertificate = count((row) => row.whtTreatment === 'WITHHELD' && row.certificateStatus !== 'ISSUED');
  const ambiguousForm = count((row) => row.whtTreatment === 'WITHHELD' && !expectedFormForPayee(row.payeeType));
  if (pending) exceptions.push({ code: 'WHT_ASSESSMENT_PENDING', source: 'TAX_EXPENSE', count: pending, severity: 'BLOCKING', message: 'WHT treatment remains pending review' });
  if (required) exceptions.push({ code: 'WHT_WITHHOLDING_NOT_COMPLETED', source: 'TAX_EXPENSE', count: required, severity: 'BLOCKING', message: 'Withholding is required but has not been marked WITHHELD' });
  if (withheldWithoutCertificate) exceptions.push({ code: 'WHT_CERTIFICATE_NOT_ISSUED', source: 'WHT_CERTIFICATE', count: withheldWithoutCertificate, severity: 'BLOCKING', message: 'Withheld items are missing an issued withholding certificate' });
  if (ambiguousForm) exceptions.push({ code: 'WHT_FORM_REVIEW_REQUIRED', source: 'WHT_CERTIFICATE', count: ambiguousForm, severity: 'REVIEW', message: 'PND3/PND53 form type must be reviewed for this payee type' });

  for (const formType of ['PND3', 'PND53']) {
    const certified = sourceRows.filter((row) => row.formType === formType && row.certificateStatus === 'ISSUED').length;
    const batch = batches.find((row) => row.formType === formType && row.status !== 'VOIDED');
    if (certified > 0 && !batch) exceptions.push({ code: `WHT_${formType}_FILING_NOT_PREPARED`, source: 'WHT_FILING', count: certified, severity: 'BLOCKING', message: `${formType} filing has not been prepared` });
    if (batch && batch.status !== 'SUBMITTED') exceptions.push({ code: `WHT_${formType}_FILING_NOT_SUBMITTED`, source: 'WHT_FILING', count: Number(batch.itemCount || 0), severity: 'BLOCKING', message: `${formType} filing has not been confirmed as submitted` });
  }
  return exceptions;
};

const loadWithholdingTaxWorkspace = async ({ branchId, taxPeriodId }, tx = prisma) => {
  const normalizedBranchId = positiveInt(branchId, 'WHT_BRANCH_REQUIRED', 'branchId');
  const normalizedPeriodId = requiredPeriodId(taxPeriodId);
  const period = await loadPeriod({ branchId: normalizedBranchId, taxPeriodId: normalizedPeriodId }, tx);

  const sourceRows = await tx.$queryRaw(Prisma.sql`
    SELECT
      expense."id" AS "taxExpenseId",
      expense."expenseNumber",
      expense."expenseDate",
      expense."counterpartyName",
      expense."counterpartyTaxId",
      payee."payeeType",
      payee."taxBranchCode" AS "payeeBranchCode",
      item."id" AS "taxExpenseItemId",
      item."lineNumber",
      item."description",
      item."subtotalAmount",
      item."whtTreatment",
      item."withholdingTaxRate",
      item."withholdingTaxAmount",
      record."id" AS "withholdingTaxRecordId",
      record."formType"::text AS "formType",
      record."status"::text AS "recordStatus",
      certificate."id" AS "certificateId",
      certificate."certificateNumber",
      certificate."status"::text AS "certificateStatus",
      certificate."issuedAt" AS "certificateIssuedAt"
    FROM "TaxExpense" expense
    JOIN "ExpensePayee" payee
      ON payee."id" = expense."expensePayeeId"
     AND payee."branchId" = expense."branchId"
    JOIN "TaxExpenseItem" item
      ON item."taxExpenseId" = expense."id"
     AND item."branchId" = expense."branchId"
    LEFT JOIN "WithholdingTaxRecord" record
      ON record."taxExpenseItemId" = item."id"
     AND record."branchId" = expense."branchId"
    LEFT JOIN "WithholdingTaxCertificate" certificate
      ON certificate."taxExpenseId" = expense."id"
     AND certificate."branchId" = expense."branchId"
    WHERE expense."branchId" = ${normalizedBranchId}
      AND expense."expenseDate" >= ${period.startDate}
      AND expense."expenseDate" <= ${period.endDate}
      AND expense."status" <> 'VOIDED'::"TaxExpenseStatus"
      AND (
        item."withholdingTaxAmount" > 0
        OR item."whtTreatment" IN (
          'PENDING_REVIEW'::"TaxExpenseWhtTreatment",
          'WITHHOLDING_REQUIRED'::"TaxExpenseWhtTreatment",
          'WITHHELD'::"TaxExpenseWhtTreatment"
        )
      )
    ORDER BY expense."expenseDate" ASC, expense."id" ASC, item."lineNumber" ASC
  `);

  const batches = await tx.$queryRaw(Prisma.sql`
    SELECT batch.*,
      batch."formType"::text AS "formType",
      batch."status"::text AS "status"
    FROM "WithholdingTaxFilingBatch" batch
    WHERE batch."branchId" = ${normalizedBranchId}
      AND batch."taxPeriodId" = ${normalizedPeriodId}
    ORDER BY batch."formType" ASC
  `);

  const rows = sourceRows.map((row) => ({
    ...row,
    subtotalAmount: money(row.subtotalAmount),
    withholdingTaxRate: row.withholdingTaxRate == null ? null : money(row.withholdingTaxRate),
    withholdingTaxAmount: money(row.withholdingTaxAmount),
    recommendedFormType: expectedFormForPayee(row.payeeType),
  }));
  const normalizedBatches = batches.map((row) => ({
    ...row,
    itemCount: Number(row.itemCount || 0),
    taxableBaseAmount: money(row.taxableBaseAmount),
    withholdingTaxAmount: money(row.withholdingTaxAmount),
  }));
  const exceptions = buildExceptions({ sourceRows: rows, batches: normalizedBatches });
  const summary = {
    sourceItemCount: rows.length,
    withheldItemCount: rows.filter((row) => row.whtTreatment === 'WITHHELD').length,
    certificateItemCount: rows.filter((row) => row.certificateStatus === 'ISSUED').length,
    taxableBaseAmount: rows.reduce((sum, row) => sum + (row.whtTreatment === 'WITHHELD' ? row.subtotalAmount : 0), 0),
    withholdingTaxAmount: rows.reduce((sum, row) => sum + (row.whtTreatment === 'WITHHELD' ? row.withholdingTaxAmount : 0), 0),
  };

  return Object.freeze({
    authority: 'WITHHOLDING_TAX_WORKSPACE',
    branchId: normalizedBranchId,
    period,
    summary,
    rows,
    filings: normalizedBatches,
    exceptions,
    readiness: {
      certificatesReady: rows.every((row) => row.whtTreatment !== 'WITHHELD' || row.certificateStatus === 'ISSUED'),
      filingsReady: normalizedBatches.filter((row) => Number(row.itemCount || 0) > 0).every((row) => row.status === 'SUBMITTED'),
      readyForAccountant: exceptions.filter((entry) => entry.severity === 'BLOCKING').length === 0,
    },
  });
};

const issueWithholdingCertificate = async ({ branchId, taxPeriodId, taxExpenseId, formType, actorEmployeeId }, database = prisma) => database.$transaction(async (tx) => {
  const normalizedBranchId = positiveInt(branchId, 'WHT_BRANCH_REQUIRED', 'branchId');
  const normalizedPeriodId = requiredPeriodId(taxPeriodId);
  const normalizedExpenseId = positiveInt(taxExpenseId, 'WHT_EXPENSE_REQUIRED', 'taxExpenseId');
  const normalizedFormType = normalizeFormType(formType);
  const normalizedActorId = actorId(actorEmployeeId);
  const period = await loadPeriod({ branchId: normalizedBranchId, taxPeriodId: normalizedPeriodId }, tx, true);
  if (String(period.status) === 'SUBMITTED') fail('WHT_PERIOD_IMMUTABLE', 'WHT certificate cannot change after the tax period is submitted', 409);

  const filingLocks = await tx.$queryRaw(Prisma.sql`
    SELECT batch."id"
    FROM "WithholdingTaxFilingItem" item
    JOIN "WithholdingTaxFilingBatch" batch
      ON batch."id" = item."batchId"
     AND batch."branchId" = item."branchId"
    WHERE item."branchId" = ${normalizedBranchId}
      AND item."taxExpenseId" = ${normalizedExpenseId}
      AND batch."status" = 'SUBMITTED'::"WithholdingTaxFilingStatus"
    LIMIT 1
  `);
  if (filingLocks[0]) fail('WHT_CERTIFICATE_ALREADY_FILED', 'Certificate cannot change after its WHT filing is submitted', 409);

  const expenses = await tx.$queryRaw(Prisma.sql`
    SELECT
      expense."id", expense."expenseNumber", expense."expenseDate", expense."counterpartyName", expense."counterpartyTaxId",
      payee."payeeType", payee."taxBranchCode", payee."address" AS "payeeAddress",
      issuer."legalName" AS "issuerLegalName", issuer."taxId" AS "issuerTaxId", issuer."branchCode" AS "issuerBranchCode",
      issuer."registeredAddress" AS "issuerAddress"
    FROM "TaxExpense" expense
    JOIN "ExpensePayee" payee
      ON payee."id" = expense."expensePayeeId"
     AND payee."branchId" = expense."branchId"
    LEFT JOIN "TaxIssuerProfile" issuer ON issuer."branchId" = expense."branchId" AND issuer."status" = 'ACTIVE'::"TaxIssuerProfileStatus"
    WHERE expense."id" = ${normalizedExpenseId}
      AND expense."branchId" = ${normalizedBranchId}
      AND expense."expenseDate" >= ${period.startDate}
      AND expense."expenseDate" <= ${period.endDate}
      AND expense."status" <> 'VOIDED'::"TaxExpenseStatus"
    LIMIT 1
  `);
  const expense = expenses[0];
  if (!expense) fail('WHT_EXPENSE_NOT_FOUND', 'Tax expense was not found in this period', 404);
  if (!expense.issuerLegalName || !expense.issuerTaxId) fail('WHT_ISSUER_PROFILE_REQUIRED', 'Active tax issuer profile is required before issuing a WHT certificate', 409);

  const expected = expectedFormForPayee(expense.payeeType);
  if (expected && expected !== normalizedFormType) {
    fail('WHT_FORM_TYPE_MISMATCH', `Payee type ${expense.payeeType} requires ${expected}`, 409, { expectedFormType: expected });
  }

  const items = await tx.$queryRaw(Prisma.sql`
    SELECT "id", "lineNumber", "description", "subtotalAmount", "whtTreatment", "withholdingTaxRate", "withholdingTaxAmount"
    FROM "TaxExpenseItem"
    WHERE "taxExpenseId" = ${normalizedExpenseId}
      AND "branchId" = ${normalizedBranchId}
      AND "withholdingTaxAmount" > 0
    ORDER BY "lineNumber" ASC
    FOR UPDATE
  `);
  if (!items.length) fail('WHT_ITEMS_REQUIRED', 'Tax expense has no WHT items', 409);
  const incomplete = items.filter((item) => item.whtTreatment !== 'WITHHELD' || money(item.withholdingTaxRate) <= 0 || money(item.withholdingTaxAmount) <= 0);
  if (incomplete.length) fail('WHT_ITEMS_NOT_WITHHELD', 'All WHT items must be assessed as WITHHELD before certificate issuance', 409, { itemIds: incomplete.map((item) => item.id) });

  const certificateNumber = `WHT-${period.periodCode}-${normalizedExpenseId}`;
  const issuerSnapshot = {
    legalName: expense.issuerLegalName,
    taxId: expense.issuerTaxId,
    branchCode: expense.issuerBranchCode,
    address: expense.issuerAddress,
  };
  const payeeSnapshot = {
    payeeType: expense.payeeType,
    name: expense.counterpartyName,
    taxId: expense.counterpartyTaxId,
    branchCode: expense.taxBranchCode,
    address: expense.payeeAddress,
  };

  const certificates = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "WithholdingTaxCertificate" (
      "id", "branchId", "taxExpenseId", "taxPeriodId", "formType", "certificateNumber", "status",
      "issuerSnapshot", "payeeSnapshot", "issuedAt", "version", "createdByEmployeeId", "issuedByEmployeeId", "createdAt", "updatedAt"
    ) VALUES (
      CONCAT('whtc_', md5(random()::text || clock_timestamp()::text)),
      ${normalizedBranchId}, ${normalizedExpenseId}, ${normalizedPeriodId}, ${normalizedFormType}::"WithholdingTaxFormType", ${certificateNumber},
      'ISSUED'::"WithholdingTaxCertificateStatus", ${JSON.stringify(issuerSnapshot)}::jsonb, ${JSON.stringify(payeeSnapshot)}::jsonb,
      NOW(), 1, ${normalizedActorId}, ${normalizedActorId}, NOW(), NOW()
    )
    ON CONFLICT ("taxExpenseId") DO UPDATE SET
      "taxPeriodId" = EXCLUDED."taxPeriodId",
      "formType" = EXCLUDED."formType",
      "certificateNumber" = EXCLUDED."certificateNumber",
      "status" = 'ISSUED'::"WithholdingTaxCertificateStatus",
      "issuerSnapshot" = EXCLUDED."issuerSnapshot",
      "payeeSnapshot" = EXCLUDED."payeeSnapshot",
      "issuedAt" = NOW(),
      "version" = "WithholdingTaxCertificate"."version" + 1,
      "issuedByEmployeeId" = EXCLUDED."issuedByEmployeeId",
      "updatedAt" = NOW()
    RETURNING *
  `);
  const certificate = certificates[0];

  for (const item of items) {
    await tx.$queryRaw(Prisma.sql`
      INSERT INTO "WithholdingTaxRecord" (
        "id", "branchId", "taxExpenseId", "taxExpenseItemId", "taxPeriodId", "certificateId", "formType",
        "payeeType", "payeeName", "payeeTaxId", "payeeBranchCode", "paidAt", "incomeDescription",
        "taxableBaseAmount", "withholdingTaxRate", "withholdingTaxAmount", "status", "createdByEmployeeId", "createdAt", "updatedAt"
      ) VALUES (
        CONCAT('whtr_', md5(random()::text || clock_timestamp()::text)),
        ${normalizedBranchId}, ${normalizedExpenseId}, ${item.id}, ${normalizedPeriodId}, ${certificate.id}, ${normalizedFormType}::"WithholdingTaxFormType",
        ${expense.payeeType}::"ExpensePayeeType", ${expense.counterpartyName}, ${expense.counterpartyTaxId}, ${expense.taxBranchCode}, ${expense.expenseDate}, ${item.description},
        ${item.subtotalAmount}, ${item.withholdingTaxRate}, ${item.withholdingTaxAmount}, 'CERTIFIED'::"WithholdingTaxRecordStatus", ${normalizedActorId}, NOW(), NOW()
      )
      ON CONFLICT ("taxExpenseItemId") DO UPDATE SET
        "taxPeriodId" = EXCLUDED."taxPeriodId",
        "certificateId" = EXCLUDED."certificateId",
        "formType" = EXCLUDED."formType",
        "payeeType" = EXCLUDED."payeeType",
        "payeeName" = EXCLUDED."payeeName",
        "payeeTaxId" = EXCLUDED."payeeTaxId",
        "payeeBranchCode" = EXCLUDED."payeeBranchCode",
        "paidAt" = EXCLUDED."paidAt",
        "incomeDescription" = EXCLUDED."incomeDescription",
        "taxableBaseAmount" = EXCLUDED."taxableBaseAmount",
        "withholdingTaxRate" = EXCLUDED."withholdingTaxRate",
        "withholdingTaxAmount" = EXCLUDED."withholdingTaxAmount",
        "status" = 'CERTIFIED'::"WithholdingTaxRecordStatus",
        "updatedAt" = NOW()
    `);
  }

  return Object.freeze({
    ...certificate,
    version: Number(certificate.version || 1),
    itemCount: items.length,
    taxableBaseAmount: items.reduce((sum, item) => sum + money(item.subtotalAmount), 0),
    withholdingTaxAmount: items.reduce((sum, item) => sum + money(item.withholdingTaxAmount), 0),
  });
});

const prepareWithholdingFiling = async ({ branchId, taxPeriodId, formType, actorEmployeeId }, database = prisma) => database.$transaction(async (tx) => {
  const normalizedBranchId = positiveInt(branchId, 'WHT_BRANCH_REQUIRED', 'branchId');
  const normalizedPeriodId = requiredPeriodId(taxPeriodId);
  const normalizedFormType = normalizeFormType(formType);
  const normalizedActorId = actorId(actorEmployeeId);
  const period = await loadPeriod({ branchId: normalizedBranchId, taxPeriodId: normalizedPeriodId }, tx, true);

  const existing = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "WithholdingTaxFilingBatch"
    WHERE "branchId" = ${normalizedBranchId} AND "taxPeriodId" = ${normalizedPeriodId}
      AND "formType" = ${normalizedFormType}::"WithholdingTaxFormType"
    LIMIT 1 FOR UPDATE
  `);
  if (existing[0]?.status === 'SUBMITTED') return existing[0];

  const records = await tx.$queryRaw(Prisma.sql`
    SELECT record.*, certificate."certificateNumber", certificate."status"::text AS "certificateStatus"
    FROM "WithholdingTaxRecord" record
    JOIN "WithholdingTaxCertificate" certificate
      ON certificate."id" = record."certificateId"
     AND certificate."branchId" = record."branchId"
    WHERE record."branchId" = ${normalizedBranchId}
      AND record."taxPeriodId" = ${normalizedPeriodId}
      AND record."formType" = ${normalizedFormType}::"WithholdingTaxFormType"
      AND record."status" IN ('CERTIFIED'::"WithholdingTaxRecordStatus", 'FILED'::"WithholdingTaxRecordStatus")
      AND certificate."status" = 'ISSUED'::"WithholdingTaxCertificateStatus"
    ORDER BY record."paidAt" ASC, record."id" ASC
    FOR UPDATE OF record
  `);
  if (!records.length) fail('WHT_FILING_NO_CERTIFIED_RECORDS', `No certified records are available for ${normalizedFormType}`, 409);

  const year = new Date(period.startDate).getUTCFullYear();
  const month = new Date(period.startDate).getUTCMonth() + 1;
  const totalBase = records.reduce((sum, row) => sum + money(row.taxableBaseAmount), 0);
  const totalTax = records.reduce((sum, row) => sum + money(row.withholdingTaxAmount), 0);
  const batches = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "WithholdingTaxFilingBatch" (
      "id", "branchId", "taxPeriodId", "formType", "year", "month", "status", "itemCount",
      "taxableBaseAmount", "withholdingTaxAmount", "preparedByEmployeeId", "preparedAt", "createdAt", "updatedAt"
    ) VALUES (
      CONCAT('whtb_', md5(random()::text || clock_timestamp()::text)),
      ${normalizedBranchId}, ${normalizedPeriodId}, ${normalizedFormType}::"WithholdingTaxFormType", ${year}, ${month},
      'PREPARED'::"WithholdingTaxFilingStatus", ${records.length}, ${totalBase.toFixed(2)}, ${totalTax.toFixed(2)}, ${normalizedActorId}, NOW(), NOW(), NOW()
    )
    ON CONFLICT ("branchId", "taxPeriodId", "formType") DO UPDATE SET
      "status" = 'PREPARED'::"WithholdingTaxFilingStatus",
      "itemCount" = EXCLUDED."itemCount",
      "taxableBaseAmount" = EXCLUDED."taxableBaseAmount",
      "withholdingTaxAmount" = EXCLUDED."withholdingTaxAmount",
      "preparedByEmployeeId" = EXCLUDED."preparedByEmployeeId",
      "preparedAt" = NOW(),
      "submissionEvidence" = NULL,
      "submittedByEmployeeId" = NULL,
      "submittedAt" = NULL,
      "updatedAt" = NOW()
    RETURNING *
  `);
  const batch = batches[0];
  await tx.$queryRaw(Prisma.sql`DELETE FROM "WithholdingTaxFilingItem" WHERE "batchId" = ${batch.id} AND "branchId" = ${normalizedBranchId}`);

  for (const row of records) {
    const snapshot = {
      recordId: row.id,
      taxExpenseId: row.taxExpenseId,
      taxExpenseItemId: row.taxExpenseItemId,
      formType: normalizedFormType,
      certificateNumber: row.certificateNumber,
      payeeName: row.payeeName,
      payeeTaxId: row.payeeTaxId,
      paidAt: row.paidAt,
      taxableBaseAmount: money(row.taxableBaseAmount),
      withholdingTaxRate: money(row.withholdingTaxRate),
      withholdingTaxAmount: money(row.withholdingTaxAmount),
    };
    await tx.$queryRaw(Prisma.sql`
      INSERT INTO "WithholdingTaxFilingItem" (
        "id", "branchId", "batchId", "withholdingTaxRecordId", "taxExpenseId", "certificateId", "certificateNumber",
        "payeeName", "payeeTaxId", "paidAt", "taxableBaseAmount", "withholdingTaxRate", "withholdingTaxAmount", "sourceSnapshot", "createdAt"
      ) VALUES (
        CONCAT('whti_', md5(random()::text || clock_timestamp()::text)),
        ${normalizedBranchId}, ${batch.id}, ${row.id}, ${row.taxExpenseId}, ${row.certificateId}, ${row.certificateNumber},
        ${row.payeeName}, ${row.payeeTaxId}, ${row.paidAt}, ${row.taxableBaseAmount}, ${row.withholdingTaxRate}, ${row.withholdingTaxAmount},
        ${JSON.stringify(snapshot)}::jsonb, NOW()
      )
    `);
  }
  return Object.freeze({ ...batch, itemCount: records.length, taxableBaseAmount: totalBase, withholdingTaxAmount: totalTax });
});

const submitWithholdingFiling = async ({ branchId, taxPeriodId, formType, evidence, actorEmployeeId }, database = prisma) => database.$transaction(async (tx) => {
  const normalizedBranchId = positiveInt(branchId, 'WHT_BRANCH_REQUIRED', 'branchId');
  const normalizedPeriodId = requiredPeriodId(taxPeriodId);
  const normalizedFormType = normalizeFormType(formType);
  const normalizedActorId = actorId(actorEmployeeId);
  const reference = String(evidence?.reference || '').trim();
  if (!reference) fail('WHT_SUBMISSION_EVIDENCE_REQUIRED', 'Manual submission evidence reference is required');
  const period = await loadPeriod({ branchId: normalizedBranchId, taxPeriodId: normalizedPeriodId }, tx, true);
  if (String(period.status) === 'SUBMITTED') fail('WHT_PERIOD_IMMUTABLE', 'WHT filing cannot change after the tax period is submitted', 409);

  const batches = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "WithholdingTaxFilingBatch"
    WHERE "branchId" = ${normalizedBranchId} AND "taxPeriodId" = ${normalizedPeriodId}
      AND "formType" = ${normalizedFormType}::"WithholdingTaxFormType"
    LIMIT 1 FOR UPDATE
  `);
  const batch = batches[0];
  if (!batch || batch.status !== 'PREPARED') fail('WHT_FILING_NOT_PREPARED', `${normalizedFormType} filing must be PREPARED before submission confirmation`, 409);

  const submitted = await tx.$queryRaw(Prisma.sql`
    UPDATE "WithholdingTaxFilingBatch"
    SET "status" = 'SUBMITTED'::"WithholdingTaxFilingStatus",
        "submissionEvidence" = ${JSON.stringify({ ...evidence, reference })}::jsonb,
        "submittedByEmployeeId" = ${normalizedActorId},
        "submittedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" = ${batch.id} AND "branchId" = ${normalizedBranchId}
    RETURNING *
  `);
  await tx.$queryRaw(Prisma.sql`
    UPDATE "WithholdingTaxRecord" record
    SET "status" = 'FILED'::"WithholdingTaxRecordStatus", "updatedAt" = NOW()
    FROM "WithholdingTaxFilingItem" item
    WHERE item."batchId" = ${batch.id}
      AND item."branchId" = ${normalizedBranchId}
      AND record."id" = item."withholdingTaxRecordId"
      AND record."branchId" = item."branchId"
  `);
  return Object.freeze(submitted[0]);
});

module.exports = Object.freeze({
  expectedFormForPayee,
  loadWithholdingTaxWorkspace,
  issueWithholdingCertificate,
  prepareWithholdingFiling,
  submitWithholdingFiling,
});
