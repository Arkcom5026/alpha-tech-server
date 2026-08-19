'use strict';

const { resolveDocumentPresentation } = require('../document-presentation/presentationConfig');
const { createPresentationSnapshotEnvelope } = require('../document-presentation/presentationSnapshot');

const positiveAccountIds = (value) => [...new Set(
  (Array.isArray(value) ? value : [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0),
)];

const snapshotAccount = (account) => Object.freeze({
  id: account.id,
  code: account.code,
  displayName: account.displayName,
  bankName: account.bankName,
  accountName: account.accountName,
  accountNumber: account.accountNumber,
  accountType: account.accountType || null,
  promptPayId: account.promptPayId || null,
});

const loadSelectedPaymentAccounts = async ({ tx, branchId, accountIds }) => {
  const ids = positiveAccountIds(accountIds);
  if (!ids.length) return [];

  const rows = await tx.storePaymentAccount.findMany({
    where: {
      branchId,
      id: { in: ids },
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      displayName: true,
      bankName: true,
      accountName: true,
      accountNumber: true,
      accountType: true,
      promptPayId: true,
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean).map(snapshotAccount);
};

const buildQuotationPresentationSnapshot = async ({ tx, branch, quotation, issuedAt }) => {
  if (!tx) throw new TypeError('transaction authority is required');
  if (!branch?.id) throw new TypeError('branch snapshot is required');
  if (!quotation?.id) throw new TypeError('quotation snapshot is required');

  const presentation = resolveDocumentPresentation({
    storeConfig: branch.documentHeaderConfig,
    documentPurpose: 'QUOTATION',
  });
  const paymentAccountSnapshots = await loadSelectedPaymentAccounts({
    tx,
    branchId: branch.id,
    accountIds: presentation?.resolved?.paymentAccountSelection?.accountIds,
  });

  const presentationSnapshot = createPresentationSnapshotEnvelope({
    businessSnapshot: {
      quotationId: quotation.id,
      code: quotation.code,
      revisionNumber: Number(quotation.revisionNumber || 0),
    },
    presentation,
    documentPurpose: 'QUOTATION',
    rendererFamily: 'A4',
    issuedAt,
  });

  return Object.freeze({ presentationSnapshot, paymentAccountSnapshots });
};

module.exports = Object.freeze({
  buildQuotationPresentationSnapshot,
  loadSelectedPaymentAccounts,
  positiveAccountIds,
});
