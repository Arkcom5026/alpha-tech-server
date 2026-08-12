const repository = require('./finalizeReceiptRepository');

const execute = async ({ id, branchId }) => {
  if (!id || !branchId) {
    return { status: 400, body: { error: 'Missing id or branch' } };
  }

  const receipt = await repository.findReceipt({ id, branchId });
  if (!receipt) {
    return { status: 404, body: { error: 'ไม่พบใบรับสินค้านี้ในสาขา' } };
  }

  const coverage = await repository.getIdentityCoverage(id);
  if (coverage.expected <= 0 || coverage.missing > 0) {
    return {
      status: 409,
      body: {
        error: coverage.expected <= 0
          ? 'ใบรับสินค้ายังไม่มีรายการสำหรับเตรียม Barcode / SN'
          : 'Barcode / SN identity ของใบรับสินค้ายังไม่ครบ',
        expectedIdentityCount: coverage.expected,
        activeIdentityCount: coverage.active,
        missingIdentityCount: coverage.missing,
      },
    };
  }

  const pending = await repository.getPendingCounts(id);
  if (pending.pendingSN + pending.pendingLOT > 0) {
    return {
      status: 409,
      body: {
        error: 'ยังมีรายการค้าง (SN/LOT) ไม่ครบ',
        pendingSN: pending.pendingSN,
        pendingLOT: pending.pendingLOT,
      },
    };
  }

  if (String(receipt.statusReceipt || '').toUpperCase() === 'COMPLETED') {
    const poStatus = await repository.syncPoStatus(receipt.purchaseOrderId);
    return { status: 200, body: { success: true, alreadyCompleted: true, poStatus } };
  }

  const result = await repository.finalize({ id, purchaseOrderId: receipt.purchaseOrderId });
  return { status: 200, body: { success: true, poStatus: result.poStatus } };
};

module.exports = { execute };
