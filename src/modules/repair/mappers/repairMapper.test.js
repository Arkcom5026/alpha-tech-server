const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mapRepairJob,
  mapWarrantyClaim,
  mapStockIdentity,
} = require('./repairMapper');

test('mapStockIdentity returns null for missing input and projects nested product labels', () => {
  assert.equal(mapStockIdentity(null), null);
  assert.deepEqual(
    mapStockIdentity({
      id: 1,
      barcode: 'BC-1',
      serialNumber: 'SN-1',
      status: 'SOLD',
      warrantyDays: 365,
      soldAt: '2026-01-01T00:00:00.000Z',
      expiredAt: null,
      branchId: 7,
      product: {
        id: 9,
        name: 'Notebook',
        brand: { name: 'Alpha' },
        productType: { name: 'Laptop' },
      },
    }),
    {
      id: 1,
      barcode: 'BC-1',
      serialNumber: 'SN-1',
      status: 'SOLD',
      warrantyDays: 365,
      soldAt: '2026-01-01T00:00:00.000Z',
      expiredAt: null,
      branchId: 7,
      product: { id: 9, name: 'Notebook', brand: 'Alpha', productType: 'Laptop' },
    }
  );
});

test('mapRepairJob converts numeric values and preserves empty collections', () => {
  const result = mapRepairJob({
    id: 11,
    jobNo: 'RP-11',
    branchId: 7,
    customerId: 3,
    customer: { companyName: 'Customer Co.' },
    stockItemId: null,
    stockItem: null,
    deviceId: 41,
    device: {
      id: 41,
      category: 'NOTEBOOK',
      brand: 'Acer',
      model: 'Aspire',
      serialNumber: '11223344',
      imei: null,
      barcode: null,
      status: 'IN_REPAIR',
    },
    deviceModel: 'Model X',
    reportedSymptoms: 'No power',
    technicianNotes: null,
    status: 'RECEIVED',
    estimatedCost: '1500.50',
    depositPaid: undefined,
    technician: null,
    partsUsed: [],
    warrantyClaims: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
  });

  assert.equal(result.customerName, 'Customer Co.');
  assert.equal(result.estimatedCost, 1500.5);
  assert.equal(result.depositPaid, null);
  assert.equal(result.stockItem, null);
  assert.equal(result.deviceId, 41);
  assert.equal(result.device.serialNumber, '11223344');
  assert.equal(result.device.brand, 'Acer');
  assert.deepEqual(result.partsUsed, []);
  assert.deepEqual(result.warrantyClaims, []);
});

test('mapRepairJob maps parts and claims with numeric unit prices', () => {
  const result = mapRepairJob({
    id: 12,
    jobNo: 'RP-12',
    branchId: 7,
    customerId: 3,
    customer: { user: { email: 'customer@example.com' } },
    stockItemId: 1,
    stockItem: null,
    deviceModel: null,
    reportedSymptoms: null,
    technicianNotes: null,
    status: 'IN_PROGRESS',
    estimatedCost: null,
    depositPaid: '200',
    technician: { id: 4, name: 'Tech', phone: '0800000000' },
    partsUsed: [{ id: 1, productId: 2, product: { name: 'RAM' }, qtyUsed: 2, unitPrice: '450' }],
    warrantyClaims: [{ id: 5, claimNo: 'CL-5', status: 'DRAFT', repairLinkState: 'LINKED_VERIFIED', supplierId: 8, supplier: { name: 'Supplier' }, openedAt: '2026-07-03T00:00:00.000Z', resolvedAt: null }],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
  });

  assert.equal(result.customerName, 'customer@example.com');
  assert.equal(result.depositPaid, 200);
  assert.equal(result.partsUsed[0].unitPrice, 450);
  assert.equal(result.warrantyClaims[0].supplierName, 'Supplier');
});

test('mapWarrantyClaim projects repair link, supplier, events and credit amount', () => {
  const result = mapWarrantyClaim({
    id: 21,
    claimNo: 'CL-21',
    branchId: 7,
    stockItemId: null,
    stockItem: null,
    deviceId: 2,
    device: {
      id: 2,
      category: 'NOTEBOOK',
      brand: 'Acer',
      model: 'Aspire',
      serialNumber: '11223344',
      imei: null,
      barcode: null,
      status: 'IN_WARRANTY_CLAIM',
    },
    repairJobId: 11,
    repairJob: { id: 11, jobNo: 'RP-11', status: 'IN_PROGRESS', customerId: 3, customer: { name: 'Buyer' } },
    repairLinkState: 'LINKED_VERIFIED',
    supplier: { id: 8, name: 'Supplier', phone: '0811111111', email: 'supplier@example.com' },
    status: 'CREDIT_PENDING',
    reason: 'Warranty',
    serviceProvider: null,
    externalClaimRef: null,
    trackingNumber: null,
    resolution: null,
    resolutionNote: null,
    replacementStockItemId: null,
    creditAmount: '900.25',
    openedAt: '2026-07-03T00:00:00.000Z',
    submittedAt: null,
    providerReceivedAt: null,
    resolvedAt: null,
    cancelledAt: null,
    events: [{ id: 1, status: 'DRAFT', note: 'Opened', occurredAt: '2026-07-03T00:00:00.000Z', performedByEmployeeId: 4, performedBy: { name: 'Tech' }, metadata: { source: 'REPAIR_JOB' } }],
    createdAt: '2026-07-03T00:00:00.000Z',
    updatedAt: '2026-07-03T00:00:00.000Z',
  });

  assert.equal(result.repairJob.customerName, 'Buyer');
  assert.equal(result.deviceId, 2);
  assert.equal(result.device.serialNumber, '11223344');
  assert.equal(result.supplier.name, 'Supplier');
  assert.equal(result.creditAmount, 900.25);
  assert.equal(result.events[0].performedByName, 'Tech');
});
