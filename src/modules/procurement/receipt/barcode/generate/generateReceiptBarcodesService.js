const repository = require('./generateReceiptBarcodesRepository');

const execute = async ({ id, branchId }) => {
  if (!id || !branchId) return { status: 400, body: { error: 'ข้อมูลไม่ครบ' } };
  const receipt = await repository.loadReceipt({ id, branchId });
  if (!receipt) return { status: 404, body: { error: 'ไม่พบเอกสารในสาขานี้' } };
  const created = await repository.generate({ receipt, branchId });
  return {
    status: 200,
    body: {
      success: true,
      count: created.length,
      generatedCount: created.length,
      alreadyComplete: created.length === 0,
    },
  };
};

module.exports = { execute };
