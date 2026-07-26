const repository = require('./printReceiptRepository');

const execute = async ({ id, branchId }) => {
  if (!id || !branchId) return { status: 400, body: { error: 'ข้อมูลไม่ครบ' } };
  const barcodes = await repository.print({ id, branchId });
  return { status: 200, body: { success: true, barcodes } };
};

module.exports = { execute };
