const repository = require('./commitReceiptRepository');
const generateService = require('../barcode/generate/generateReceiptBarcodesService');

const execute = async ({ id, branchId }) => {
  if (!id || !branchId) return { status: 400, body: { error: 'ข้อมูลไม่ครบ' } };

  const existing = await repository.countBarcodes({ id, branchId });
  if (existing === 0) {
    const generated = await generateService.execute({ id, branchId });
    if (generated.status >= 400) return generated;
  }

  const data = await repository.commit({ id, branchId });
  return { status: 200, body: { success: true, data } };
};

module.exports = { execute };
