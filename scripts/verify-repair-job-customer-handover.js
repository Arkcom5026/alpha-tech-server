const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {
  activeWarrantyClaims,
} = require('../src/modules/repair/services/repairHandoverService');
const {
  validateRepairHandover,
} = require('../src/modules/repair/validators/repairValidator');
const {
  RepairFailureCode,
} = require('../src/modules/repair/contracts/repairError');

function verifyActiveClaimGuard() {
  const job = {
    warrantyClaims: [
      { id: 1, claimNo: 'WC-1', status: 'RESOLVED' },
      { id: 2, claimNo: 'WC-2', status: 'CANCELLED' },
      { id: 3, claimNo: 'WC-3', status: 'INSPECTING' },
    ],
  };

  const active = activeWarrantyClaims(job);
  assert.equal(active.length, 1);
  assert.equal(active[0].claimNo, 'WC-3');
}

function verifyPayloadValidation() {
  assert.deepEqual(validateRepairHandover({}), { note: null });
  assert.deepEqual(validateRepairHandover({ note: ' ส่งคืนพร้อมสายชาร์จ ' }), {
    note: 'ส่งคืนพร้อมสายชาร์จ',
  });
}

function verifyFailureContracts() {
  assert.equal(
    RepairFailureCode.REPAIR_JOB_NOT_READY_FOR_HANDOVER,
    'REPAIR_JOB_NOT_READY_FOR_HANDOVER'
  );
  assert.equal(
    RepairFailureCode.ACTIVE_CLAIM_BLOCKS_HANDOVER,
    'REPAIR_ACTIVE_CLAIM_BLOCKS_HANDOVER'
  );
}

function verifyRuntimeWiring() {
  const service = fs.readFileSync(
    path.join(
      __dirname,
      '../src/modules/repair/services/repairHandoverService.js'
    ),
    'utf8'
  );
  const controller = fs.readFileSync(
    path.join(__dirname, '../src/modules/repair/controllers/repairController.js'),
    'utf8'
  );
  const routes = fs.readFileSync(
    path.join(__dirname, '../src/modules/repair/routes/repairRoutes.js'),
    'utf8'
  );

  assert.match(service, /job\.status !== 'COMPLETED'/);
  assert.match(service, /ACTIVE_CLAIM_BLOCKS_HANDOVER/);
  assert.match(service, /status:\s*'RETURNED_TO_CUSTOMER'/);
  assert.match(service, /lastCustomerHandover/);
  assert.match(service, /handedOverByEmployeeId:\s*actor\.employeeId/);
  assert.match(service, /idempotent:\s*true/);
  assert.match(controller, /handoverToCustomer/);
  assert.match(routes, /\/jobs\/:id\/handover/);
}

verifyActiveClaimGuard();
verifyPayloadValidation();
verifyFailureContracts();
verifyRuntimeWiring();

console.log('Repair Job Customer Handover: PASS');
