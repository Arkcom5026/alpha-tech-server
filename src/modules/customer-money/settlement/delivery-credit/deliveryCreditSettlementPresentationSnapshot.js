'use strict';

const {
  freezeFinanceOperationalPresentation,
} = require('../../../document-presentation/financeOperationalPresentationSnapshotService');

const DELIVERY_CREDIT_SETTLEMENT_SOURCE = 'DELIVERY_CREDIT_SETTLEMENT';
const DELIVERY_CREDIT_SETTLEMENT_PURPOSE = 'DELIVERY_CREDIT_SETTLEMENT';

const freezeDeliveryCreditSettlementPresentation = ({ tx, settlement }) => {
  if (!settlement) throw new TypeError('settlement is required');
  return freezeFinanceOperationalPresentation({
    tx,
    branchId: settlement.branchId,
    sourceType: DELIVERY_CREDIT_SETTLEMENT_SOURCE,
    sourceId: settlement.id,
    documentPurpose: DELIVERY_CREDIT_SETTLEMENT_PURPOSE,
    issuedAt: settlement.settledAt || settlement.createdAt || new Date(),
  });
};

const serializeDeliveryCreditSettlementPresentationSnapshots = (snapshots = {}) => Object.fromEntries(
  Object.entries(snapshots).map(([rendererFamily, record]) => [rendererFamily, record?.snapshot || null]),
);

module.exports = Object.freeze({
  DELIVERY_CREDIT_SETTLEMENT_SOURCE,
  DELIVERY_CREDIT_SETTLEMENT_PURPOSE,
  freezeDeliveryCreditSettlementPresentation,
  serializeDeliveryCreditSettlementPresentationSnapshots,
});
