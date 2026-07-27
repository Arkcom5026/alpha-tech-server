const assert = require('node:assert/strict');
const test = require('node:test');
const {
  parseConsent,
  mapEvidence,
} = require('../intakeEvidencePolicy');

test('parseConsent requires signer name for digital confirmation', () => {
  assert.throws(
    () => parseConsent({ confirmed: 'true' }),
    (error) => error.statusCode === 400
  );
});

test('parseConsent maps explicit permissions without implicit consent', () => {
  const result = parseConsent({
    confirmed: 'true',
    customerSignature: 'สมชาย ใจดี',
    allowDisassembly: 'true',
    allowDataErase: 'false',
  });
  assert.equal(result.confirmed, true);
  assert.equal(result.data.customerSignature, 'สมชาย ใจดี');
  assert.equal(result.data.allowDisassembly, true);
  assert.equal(result.data.allowDataErase, false);
  assert.ok(result.data.signedAt instanceof Date);
});

test('mapEvidence returns customer confirmation and photos', () => {
  const projection = mapEvidence({
    id: 10,
    referenceNo: 'EXT-2-X',
    receivedAt: new Date('2026-07-27T00:00:00Z'),
    receivedBy: { id: 35, name: 'Admin' },
    consent: { customerSignature: 'สมชาย' },
    photos: [{ id: 1, url: 'https://example.com/photo.jpg' }],
  });
  assert.equal(projection.intakeId, 10);
  assert.equal(projection.photos.length, 1);
  assert.equal(projection.consent.customerSignature, 'สมชาย');
});
