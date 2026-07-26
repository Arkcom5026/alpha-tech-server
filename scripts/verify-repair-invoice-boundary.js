const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {
  invoiceHistory,
  createInvoiceNumber,
} = require('../src/modules/repair/services/repairInvoiceService');

function verifyHelpers() {
  assert.deepEqual(invoiceHistory(null), []);
  assert.deepEqual(invoiceHistory({ repairInvoices: [{ id: 'inv-1' }] }), [{ id: 'inv-1' }]);
  assert.equal(createInvoiceNumber('REP-0007', 1), 'INV-REP-0007-01');
  assert.equal(createInvoiceNumber('REP/0007', 12), 'INV-REP0007-12');
}

function verifyRuntimeWiring() {
  const serviceSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/repair/services/repairInvoiceService.js'),
    'utf8'
  );
  const controllerSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/repair/controllers/repairController.js'),
    'utf8'
  );
  const routesSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/repair/routes/repairRoutes.js'),
    'utf8'
  );

  assert.match(serviceSource, /latestApprovedEstimate/);
  assert.match(serviceSource, /calculateSettlement/);
  assert.match(serviceSource, /repairInvoices/);
  assert.match(serviceSource, /status:\s*'ISSUED'/);
  assert.match(serviceSource, /idempotent:\s*true/);
  assert.match(controllerSource, /listInvoices/);
  assert.match(controllerSource, /issueInvoice/);
  assert.match(routesSource, /\/jobs\/:id\/invoices/);
}

verifyHelpers();
verifyRuntimeWiring();
console.log('Repair Invoice Boundary: PASS');
