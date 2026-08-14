const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mapEvidence } = require('../src/modules/repair/intake-evidence/intakeEvidencePolicy');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');

const snapshot = {
  id: 81,
  brand: 'Epson',
  model: 'L3210',
  serialNumber: 'SN-INTAKE',
  imei: null,
  barcode: 'BC-INTAKE',
};

test('intake evidence projects the same canonical historical repair asset', () => {
  const evidence = mapEvidence({
    id: 71,
    referenceNo: 'IN-71',
    assetDescription: 'Epson L3210',
    snapshot,
    repairJob: {
      id: 61,
      deviceModel: 'legacy name',
      device: { brand: 'Changed later', model: 'Changed later' },
      stockItem: null,
    },
    consent: null,
    photos: [],
  });

  assert.equal(evidence.repairAsset.displayName, 'Epson L3210');
  assert.equal(evidence.repairAsset.model, 'L3210');
  assert.equal(evidence.repairAsset.serialNumber, 'SN-INTAKE');
});

test('completion and handover snapshot canonical repairAsset without merging their authorities', () => {
  const completion = read('src', 'modules', 'repair', 'workflow', 'commands', 'transitionRepairWorkflowService.js');
  const handover = read('src', 'modules', 'repair', 'handover', 'repairHandoverService.js');

  assert.match(completion, /repairCompletion: repairCompletion[\s\S]*repairAsset: mapRepairJob\(repairJob\)\.repairAsset/);
  assert.match(handover, /contractVersion: 'repair-handover\.v4'/);
  assert.match(handover, /const repairAsset = mapRepairAsset\(job\)/);
  assert.match(handover, /accessories:[\s\S]*repairAsset,/);
  assert.match(handover, /workflowTargetStatus: 'DELIVERED'/);
});

test('evidence and handover repositories load intake snapshots for canonical precedence', () => {
  const evidenceRepository = read('src', 'modules', 'repair', 'intake-evidence', 'intakeEvidenceRepository.js');
  const handoverRepository = read('src', 'modules', 'repair', 'handover', 'repairHandoverRepository.js');

  assert.match(evidenceRepository, /snapshot: true/);
  assert.match(handoverRepository, /snapshot: true/);
});
