const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateLookup,
  validateCreateRepairJob,
  validateRepairStatusUpdate,
  validateAddPart,
  validateOpenWarrantyClaim,
  validateClaimStatusUpdate,
  validateListQuery,
} = require('./repairValidator');

test('validateLookup trims valid values and rejects empty or oversized lookup', () => {
  assert.equal(validateLookup('  BC-100  '), 'BC-100');
  assert.throws(() => validateLookup(''), { code: 'REPAIR_INVALID_LOOKUP', status: 'fail' });
  assert.throws(() => validateLookup('x'.repeat(161)), { code: 'REPAIR_INVALID_LOOKUP' });
});

test('validateCreateRepairJob normalizes identifiers, money, text and override flag', () => {
  const result = validateCreateRepairJob({
    customerId: '10',
    stockItemId: '20',
    deviceModel: '  Model X  ',
    reportedSymptoms: '  No power  ',
    depositPaid: '500.25',
    estimatedCost: '',
    technicianId: '30',
    technicianNotes: '  Inspect board  ',
    allowCustomerOverride: 'true',
  });

  assert.deepEqual(result, {
    customerId: 10,
    stockItemId: 20,
    deviceId: null,
    assetDescription: 'Model X',
    deviceModel: 'Model X',
    reportedSymptoms: 'No power',
    depositPaid: 500.25,
    estimatedCost: 0,
    technicianId: 30,
    technicianNotes: 'Inspect board',
    allowCustomerOverride: true,
  });
});

test('validateCreateRepairJob rejects invalid identifiers, missing text and negative money', () => {
  assert.throws(() => validateCreateRepairJob({}), { code: 'REPAIR_INVALID_INPUT', status: 'fail' });
  assert.throws(
    () => validateCreateRepairJob({ customerId: 1, deviceModel: 'M', reportedSymptoms: 'S', depositPaid: -1 }),
    { code: 'REPAIR_INVALID_INPUT' }
  );
  assert.throws(
    () => validateCreateRepairJob({ customerId: 1.5, deviceModel: 'M', reportedSymptoms: 'S' }),
    { code: 'REPAIR_INVALID_INPUT' }
  );
});

test('validateRepairStatusUpdate uppercases status and normalizes optional fields', () => {
  assert.deepEqual(validateRepairStatusUpdate({ status: ' in_progress ', technicianId: '', technicianNotes: '' }), {
    status: 'IN_PROGRESS',
    technicianId: null,
    technicianNotes: null,
  });
});

test('validateAddPart requires positive integer product and quantity', () => {
  assert.deepEqual(validateAddPart({ productId: '4', qtyUsed: '2' }), {
    productId: 4,
    stockItemId: null,
    qtyUsed: 2,
  });
  assert.throws(() => validateAddPart({ productId: 4, qtyUsed: 0 }), { code: 'REPAIR_INVALID_INPUT' });
});

test('validateOpenWarrantyClaim trims text and supports optional supplier data', () => {
  assert.deepEqual(validateOpenWarrantyClaim({ reason: '  Defect  ', supplierId: '', note: '' }), {
    supplierId: null,
    reason: 'Defect',
    serviceProvider: null,
    externalClaimRef: null,
    trackingNumber: null,
    note: null,
  });
});

test('validateClaimStatusUpdate normalizes supported resolutions and rejects unknown values', () => {
  const result = validateClaimStatusUpdate({
    status: 'resolved',
    resolution: 'credited',
    creditAmount: '0',
    replacementStockItemId: '',
  });
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.resolution, 'CREDITED');
  assert.equal(result.creditAmount, 0);
  assert.equal(result.replacementStockItemId, null);

  assert.throws(
    () => validateClaimStatusUpdate({ status: 'resolved', resolution: 'unknown' }),
    { code: 'REPAIR_INVALID_INPUT', status: 'fail' }
  );
});

test('validateListQuery clamps pagination and normalizes filters', () => {
  assert.deepEqual(validateListQuery({ status: ' draft ', stockItemId: '8', customerId: '', limit: 500, offset: -2 }), {
    status: 'DRAFT',
    stockItemId: 8,
    customerId: null,
    limit: 100,
    offset: 0,
  });
  assert.deepEqual(validateListQuery({ limit: 'bad', offset: 'bad' }), {
    status: null,
    stockItemId: null,
    customerId: null,
    limit: 50,
    offset: 0,
  });
});
