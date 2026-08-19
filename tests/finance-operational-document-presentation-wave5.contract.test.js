'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const capability = require('../src/modules/document-presentation/presentationCapabilityRegistry');
const serviceSource = read('src/modules/document-presentation/financeOperationalPresentationSnapshotService.js');
const receiveSource = read('src/modules/customer-money/receive/receiveCustomerMoneyService.js');
const settlementPresentationSource = read('src/modules/customer-money/settlement/delivery-credit/deliveryCreditSettlementPresentationSnapshot.js');
const settlementCreateSource = read('src/modules/customer-money/settlement/delivery-credit/createDeliveryCreditSettlementService.js');
const settlementQuerySource = read('src/modules/customer-money/settlement/delivery-credit/queryDeliveryCreditSettlementService.js');
const consolidatedDeliverySource = read('src/modules/finance/combined-billing/create/createSettlementConsolidatedDelivery.js');

for (const code of ['CUSTOMER_MONEY_RECEIPT', 'DELIVERY_CREDIT_SETTLEMENT', 'REFUND_RECEIPT']) {
  const profile = capability.getDocumentPresentationCapability(code);
  assert(profile, `${code} must have a presentation capability profile`);
  assert.strictEqual(profile.className, 'FINANCE_OPERATIONAL');
  assert(profile.rendererFamilies.includes('A4'));
  assert(profile.rendererFamilies.includes('THERMAL_80MM'));
  assert(profile.protectedBlocks.includes('SYSTEM_NOTICE'));
  assert(!profile.storeBlocks.includes('SYSTEM_NOTICE'));
}

assert(serviceSource.includes('getOrCreatePresentationSnapshot'));
assert(serviceSource.includes("capability.className !== 'FINANCE_OPERATIONAL'"));
assert(serviceSource.includes('branch.documentHeaderConfig'));
assert(serviceSource.includes('for (const rendererFamily of rendererFamilies)'));
assert(serviceSource.includes('storeIdentity'));
assert(serviceSource.includes('businessSnapshot: frozenBusinessSnapshot'));

assert(receiveSource.includes('freezeCustomerMoneyReceiptPresentation'));
assert(receiveSource.includes('const presentationSnapshots = await freezeCustomerMoneyReceiptPresentation({ tx, receipt })'));
assert(receiveSource.includes("documentPurpose: CUSTOMER_MONEY_RECEIPT_PURPOSE"));
assert(receiveSource.includes('presentationSnapshots: serializePresentationSnapshots(presentationSnapshots)'));
assert(receiveSource.includes('freezeCustomerMoneyReceiptPresentation({ tx: prisma, receipt })'));
assert(receiveSource.indexOf('freezeCustomerMoneyReceiptPresentation({ tx, receipt })') < receiveSource.indexOf('await createLedger({'), 'presentation must freeze inside the receive transaction before completion returns');

assert(settlementPresentationSource.includes("DELIVERY_CREDIT_SETTLEMENT_SOURCE = 'DELIVERY_CREDIT_SETTLEMENT'"));
assert(settlementPresentationSource.includes("DELIVERY_CREDIT_SETTLEMENT_PURPOSE = 'DELIVERY_CREDIT_SETTLEMENT'"));
assert(settlementPresentationSource.includes('freezeFinanceOperationalPresentation'));
assert(settlementCreateSource.includes('freezeDeliveryCreditSettlementPresentation'));
assert(settlementCreateSource.includes('presentationSnapshots: serializeDeliveryCreditSettlementPresentationSnapshots(presentationSnapshots)'));
assert(
  settlementCreateSource.indexOf('freezeDeliveryCreditSettlementPresentation({ tx, settlement: fresh })')
    < settlementCreateSource.indexOf('presentationSnapshots: serializeDeliveryCreditSettlementPresentationSnapshots(presentationSnapshots)'),
  'settlement presentation must freeze before the creation transaction serializes and returns the snapshot authority',
);
assert(settlementQuerySource.includes('freezeDeliveryCreditSettlementPresentation({ tx: prisma, settlement: row })'));
assert(settlementQuerySource.includes('result.presentationSnapshots = serializeDeliveryCreditSettlementPresentationSnapshots(presentationSnapshots)'));
assert(!consolidatedDeliverySource.includes('freezeDeliveryCreditSettlementPresentation'), 'Combined Billing creation must not own Delivery Credit Settlement presentation snapshots.');

console.log('Finance Operational Document Presentation Wave 5 Contract: PASS');
