'use strict';

const {
  freezeFinanceOperationalPresentation,
} = require('../../../document-presentation/financeOperationalPresentationSnapshotService');

const REFUND_RECEIPT_SOURCE = 'REFUND_RECEIPT';
const REFUND_RECEIPT_PURPOSE = 'REFUND_RECEIPT';

const freezeRefundReceiptPresentation = ({ tx, saleReturn }) => {
  if (!saleReturn) throw new TypeError('saleReturn is required');
  return freezeFinanceOperationalPresentation({
    tx,
    branchId: saleReturn.branchId,
    sourceType: REFUND_RECEIPT_SOURCE,
    sourceId: saleReturn.id,
    documentPurpose: REFUND_RECEIPT_PURPOSE,
    issuedAt: saleReturn.createdAt || new Date(),
  });
};

const serializeRefundReceiptPresentationSnapshots = (snapshots = {}) => Object.fromEntries(
  Object.entries(snapshots).map(([rendererFamily, record]) => [rendererFamily, record?.snapshot || null]),
);

module.exports = Object.freeze({
  REFUND_RECEIPT_SOURCE,
  REFUND_RECEIPT_PURPOSE,
  freezeRefundReceiptPresentation,
  serializeRefundReceiptPresentationSnapshots,
});
