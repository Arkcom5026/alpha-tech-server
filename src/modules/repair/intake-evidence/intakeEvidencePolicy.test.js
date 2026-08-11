const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseConsent,
  parseOptionalBoolean,
} = require('./intakeEvidencePolicy');

test('omitted consent permissions stay undefined so Prisma update preserves existing authority', () => {
  const parsed = parseConsent({
    confirmed: 'true',
    customerSignature: 'ลูกค้าเดิม',
  });

  assert.equal(parsed.confirmed, true);
  assert.equal(parsed.data.allowDataErase, undefined);
  assert.equal(parsed.data.allowFactoryReset, undefined);
  assert.equal(parsed.data.allowDisassembly, undefined);
  assert.equal(parsed.data.allowOutsourceRepair, undefined);
  assert.equal(parsed.data.customerSignature, 'ลูกค้าเดิม');
  assert.ok(parsed.data.signedAt instanceof Date);
});

test('explicit false remains an intentional permission update', () => {
  const parsed = parseConsent({
    confirmed: 'true',
    customerSignature: 'ลูกค้าเดิม',
    allowDataErase: 'false',
    allowFactoryReset: '0',
    allowDisassembly: false,
    allowOutsourceRepair: 'false',
  });

  assert.equal(parsed.data.allowDataErase, false);
  assert.equal(parsed.data.allowFactoryReset, false);
  assert.equal(parsed.data.allowDisassembly, false);
  assert.equal(parsed.data.allowOutsourceRepair, false);
});

test('explicit true remains an intentional permission update', () => {
  const parsed = parseConsent({
    confirmed: true,
    customerSignature: 'ลูกค้าเดิม',
    allowOutsourceRepair: '1',
  });

  assert.equal(parsed.data.allowOutsourceRepair, true);
});

test('parseOptionalBoolean distinguishes omitted from false', () => {
  assert.equal(parseOptionalBoolean({}, 'allowOutsourceRepair'), undefined);
  assert.equal(parseOptionalBoolean({ allowOutsourceRepair: 'false' }, 'allowOutsourceRepair'), false);
  assert.equal(parseOptionalBoolean({ allowOutsourceRepair: 'true' }, 'allowOutsourceRepair'), true);
});
