'use strict';

const { prisma } = require('../src/lib/prisma');

const fail = (message) => {
  const error = new Error(message);
  error.code = 'DOCUMENT_REPLACEMENT_RUNTIME_VERIFICATION_FAILED';
  throw error;
};

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

const positiveInt = (value, name) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(`${name} must be a positive integer`);
  return parsed;
};

const amount = (value) => Number(Number(value || 0).toFixed(2));

const main = async () => {
  const saleId = positiveInt(argValue('--sale'), '--sale');
  const branchIdArg = argValue('--branch');
  const branchId = branchIdArg == null ? null : positiveInt(branchIdArg, '--branch');

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, ...(branchId ? { branchId } : {}) },
    select: { id: true, branchId: true, code: true, totalAmount: true, vat: true },
  });
  if (!sale) fail('Sale not found');

  const preparation = await prisma.saleDocumentPreparation.findUnique({
    where: {
      branchId_sourceType_sourceId: {
        branchId: sale.branchId,
        sourceType: 'SALE',
        sourceId: String(sale.id),
      },
    },
  });
  if (!preparation || preparation.status !== 'LOCKED' || !preparation.finalSnapshot) {
    fail('Locked document preparation not found');
  }

  const replacements = await prisma.saleDocumentReplacement.findMany({
    where: { branchId: sale.branchId, preparationId: preparation.id },
    orderBy: { replacementNumber: 'asc' },
  });
  if (!replacements.length) fail('No document replacement found');

  const current = replacements.filter((item) => item.currentKey && item.status === 'LOCKED');
  if (current.length !== 1) fail(`Expected exactly one current LOCKED replacement, found ${current.length}`);
  const currentReplacement = current[0];
  if (!currentReplacement.finalSnapshot) fail('Current replacement has no immutable finalSnapshot');

  for (let index = 0; index < replacements.length; index += 1) {
    const replacement = replacements[index];
    if (replacement.replacementNumber !== index + 1) {
      fail(`Replacement numbering gap at id ${replacement.id}`);
    }
    if (replacement.id !== currentReplacement.id && replacement.status === 'LOCKED') {
      fail(`Non-current replacement ${replacement.id} must not remain LOCKED`);
    }
    if (replacement.status === 'SUPERSEDED' && !replacement.supersededAt) {
      fail(`SUPERSEDED replacement ${replacement.id} is missing supersededAt`);
    }
  }

  const candidatePrefix = `${preparation.id}:`;
  const taxDocuments = await prisma.taxDocument.findMany({
    where: {
      branchId: sale.branchId,
      candidate: {
        is: {
          sourceType: 'DOCUMENT_PREPARATION',
          sourceId: { startsWith: candidatePrefix },
        },
      },
    },
    include: {
      candidate: { select: { sourceId: true } },
      outputVatRecord: true,
    },
    orderBy: { id: 'asc' },
  });
  if (!taxDocuments.length) fail('No preparation tax documents found');

  const financialLock = currentReplacement.financialLock || {};
  const portions = financialLock.portions || {};

  for (const document of taxDocuments) {
    const portion = String(document.candidate?.sourceId || '').split(':').pop();
    const lockedPortion = portions[portion];
    if (!lockedPortion) fail(`Financial lock missing ${portion}`);

    if (String(document.taxInvoiceKind || '') !== String(lockedPortion.taxInvoiceKind || '')) {
      fail(`${portion} taxInvoiceKind changed`);
    }
    if (amount(document.subtotalAmount) !== amount(lockedPortion.subtotalAmount)) {
      fail(`${portion} subtotal changed`);
    }
    if (amount(document.taxAmount) !== amount(lockedPortion.taxAmount)) {
      fail(`${portion} VAT changed`);
    }
    if (amount(document.totalAmount) !== amount(lockedPortion.totalAmount)) {
      fail(`${portion} total changed`);
    }

    const vat = document.outputVatRecord;
    if (vat) {
      if (amount(vat.subtotalAmount) !== amount(document.subtotalAmount)) fail(`${portion} Output VAT subtotal drift`);
      if (amount(vat.taxAmount) !== amount(document.taxAmount)) fail(`${portion} Output VAT amount drift`);
      if (amount(vat.totalAmount) !== amount(document.totalAmount)) fail(`${portion} Output VAT total drift`);
      if (vat.taxInvoiceKind !== document.taxInvoiceKind) fail(`${portion} Output VAT kind drift`);
      if (vat.issuedDocumentNumber !== document.issuedDocumentNumber) fail(`${portion} issued number drift`);
      if (lockedPortion.taxPeriodId && vat.taxPeriodId !== lockedPortion.taxPeriodId) fail(`${portion} tax period drift`);
    }
  }

  const snapshotTotals = currentReplacement.finalSnapshot.totals || {};
  if (amount(snapshotTotals.sourceTotal) !== amount(preparation.finalSnapshot?.totals?.sourceTotal)) {
    fail('Replacement source total differs from locked preparation source total');
  }
  if (amount(snapshotTotals.sourceTaxAmount) !== amount(preparation.finalSnapshot?.source?.taxAmount)) {
    fail('Replacement source tax differs from locked preparation source tax');
  }

  console.log(JSON.stringify({
    ok: true,
    saleId: sale.id,
    branchId: sale.branchId,
    preparationId: preparation.id,
    replacementCount: replacements.length,
    currentReplacement: {
      id: currentReplacement.id,
      replacementNumber: currentReplacement.replacementNumber,
      status: currentReplacement.status,
      replacesReplacementId: currentReplacement.replacesReplacementId,
    },
    taxDocuments: taxDocuments.map((document) => ({
      id: document.id,
      portion: String(document.candidate?.sourceId || '').split(':').pop(),
      taxInvoiceKind: document.taxInvoiceKind,
      issuedDocumentNumber: document.issuedDocumentNumber,
      subtotalAmount: amount(document.subtotalAmount),
      taxAmount: amount(document.taxAmount),
      totalAmount: amount(document.totalAmount),
      outputVatRecordId: document.outputVatRecord?.id || null,
      taxPeriodId: document.outputVatRecord?.taxPeriodId || null,
    })),
  }, null, 2));
  console.log('Document replacement runtime verification: PASS');
};

main()
  .catch((error) => {
    console.error(error.code || 'DOCUMENT_REPLACEMENT_RUNTIME_VERIFICATION_FAILED', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
