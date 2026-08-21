const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const root = path.resolve(__dirname, '../../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('settlement close remains explicit and independent for migrated positions', () => {
  assert.equal(hasCapability({ positionCapabilities: [] }, POSITION_CAPABILITIES.SALES_SETTLEMENT_CLOSE), false);
  assert.equal(hasCapability({ positionCapabilities: [POSITION_CAPABILITIES.SALES_PAYMENT_MANAGE] }, POSITION_CAPABILITIES.SALES_SETTLEMENT_CLOSE), false);
  assert.equal(hasCapability({ positionCapabilities: [POSITION_CAPABILITIES.SALES_SETTLEMENT_CLOSE] }, POSITION_CAPABILITIES.SALES_SETTLEMENT_CLOSE), true);
});

test('platform and legacy compatibility retain mark-paid behavior', () => {
  for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    assert.equal(hasCapability({ employeeRole: role }, POSITION_CAPABILITIES.SALES_SETTLEMENT_CLOSE), true);
  }
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    assert.equal(hasCapability({ role }, POSITION_CAPABILITIES.SALES_SETTLEMENT_CLOSE), true);
  }
});

test('only mark-paid is gated by settlement close in the mixed sale router', () => {
  const routes = read('src/modules/sales/routes/saleRoutes.js');
  assert.match(routes, /router\.post\('\/:id\/mark-paid', requireSaleSettlementClose, markSaleAsPaid\)/);
  assert.match(routes, /router\.post\('\/:id\/delivery-note', issueSaleDeliveryNoteController\)/);
  assert.match(routes, /router\.use\('\/returns', saleReturnRoutes\)/);
  assert.doesNotMatch(routes, /requireSaleSettlementClose, issueSaleDeliveryNoteController/);
});
