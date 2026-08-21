'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const includeProductionSchema = process.argv.includes('--production-schema');

const steps = [
  ['node', ['tests/delivery-note-lifecycle-wave1b-print-read-integration.contract.test.js']],
  ['node', ['tests/delivery-note-lifecycle-wave1c-history-projection.contract.test.js']],
  ['node', ['tests/delivery-note-lifecycle-wave1d-unified-history-integration.contract.test.js']],
  ['node', ['tests/delivery-note-lifecycle-wave1e-document-workspace-read-authority.contract.test.js']],
  ['node', ['tests/delivery-note-lifecycle-wave1f-document-workspace-write-guard.contract.test.js']],
  ['node', ['tests/delivery-note-lifecycle-wave2-persistence-lineage.contract.test.js']],
  ['node', ['tests/delivery-note-lifecycle-wave2b-materialization-revision-authority.contract.test.js']],
  ['node', ['tests/delivery-note-lifecycle-wave2c-current-read-print-resolution.contract.test.js']],
  ['node', ['tests/delivery-note-lifecycle-wave2d-historical-lineage-read.contract.test.js']],
  ['node', ['tests/delivery-note-lifecycle-wave2e-historical-revision-print.contract.test.js']],
  ['node', ['tests/delivery-note-lifecycle-wave2f-revision-http-numbering.contract.test.js']],
  ['node', ['tests/delivery-note-lifecycle-wave2g-migration-transactional-readiness.contract.test.js']],
  ['node', ['tests/delivery-note-history-print-eligibility.contract.test.js']],
  ['node', ['tests/sale-delivery-note-print-projection.contract.test.js']],
  ['node', ['--check', 'src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionAuthority.js']],
  ['node', ['--check', 'src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionService.js']],
  ['node', ['--check', 'src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionHistoryService.js']],
  ['node', ['--check', 'src/modules/sales/documents/print/projectCurrentSaleDeliveryNoteService.js']],
  ['node', ['--check', 'src/modules/sales/documents/print/projectHistoricalSaleDeliveryNoteRevisionService.js']],
  ['node', ['--check', 'src/modules/sales/documents/controllers/saleDeliveryNoteController.js']],
  ['node', ['--check', 'src/modules/sales/routes/saleRoutes.js']],
];

if (includeProductionSchema) {
  steps.push(['node', ['scripts/verify-delivery-note-lifecycle-wave2g-production-schema.js']]);
}

for (const [command, args] of steps) {
  const label = `${command} ${args.join(' ')}`;
  console.log(`\n[Wave 2H] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    console.error(`[Wave 2H] FAIL: ${label}`);
    process.exit();
  }
}

console.log('\nDelivery Note lifecycle Wave 2H integration certification: PASS');
