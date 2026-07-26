const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {
  validatePartReversal,
  TERMINAL_REPAIR_STATUSES,
} = require('../src/modules/repair/services/repairPartReversalService');
const {
  RepairFailureCode,
} = require('../src/modules/repair/contracts/repairError');

function verifyPayloadContract() {
  assert.deepEqual(validatePartReversal({ reason: ' เบิกผิดรุ่น ' }), {
    reason: 'เบิกผิดรุ่น',
  });

  assert.throws(
    () => validatePartReversal({ reason: '   ' }),
    (error) =>
      error.code === RepairFailureCode.REPAIR_PART_REVERSAL_REASON_REQUIRED
  );
}

function verifyTerminalPolicy() {
  assert.deepEqual(TERMINAL_REPAIR_STATUSES, [
    'COMPLETED',
    'RETURNED_TO_CUSTOMER',
    'CANCELLED',
  ]);
}

function verifyRuntimeWiring() {
  const serviceSource = fs.readFileSync(
    path.join(
      __dirname,
      '../src/modules/repair/services/repairPartReversalService.js'
    ),
    'utf8'
  );
  const repositorySource = fs.readFileSync(
    path.join(
      __dirname,
      '../src/modules/repair/repositories/repairPartUsageRepository.js'
    ),
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

  assert.match(serviceSource, /this\.repository\.transaction/);
  assert.match(serviceSource, /repo\.restoreStock/);
  assert.match(serviceSource, /refType:\s*'REPAIR_JOB_PART_REVERSAL'/);
  assert.match(serviceSource, /repo\.deletePartUsage/);
  assert.match(repositorySource, /quantity:\s*\{ increment:/);
  assert.match(repositorySource, /repairPartItem\.delete/);
  assert.match(controllerSource, /reversePartUsage/);
  assert.match(routesSource, /\/jobs\/:id\/parts\/:partItemId\/reversal/);
}

function verifyFailureContracts() {
  assert.equal(
    RepairFailureCode.REPAIR_PART_NOT_FOUND,
    'REPAIR_PART_NOT_FOUND'
  );
  assert.equal(
    RepairFailureCode.REPAIR_PART_REVERSAL_REASON_REQUIRED,
    'REPAIR_PART_REVERSAL_REASON_REQUIRED'
  );
}

verifyPayloadContract();
verifyTerminalPolicy();
verifyRuntimeWiring();
verifyFailureContracts();

console.log('Repair Part Usage Reversal: PASS');
