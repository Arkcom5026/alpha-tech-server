const repository = require('./markReceiptPrintedRepository');

const execute = async ({ id, branchId }) => {
  if (!id || !branchId) {
    return {
      status: 400,
      body: { message: 'ต้องระบุ id และต้องมีสิทธิ์สาขา (branchId) จาก token' },
    };
  }

  const result = await repository.markPrinted({ id, branchId });
  if (result.count === 0) {
    return {
      status: 404,
      body: { message: 'ไม่พบใบรับของสำหรับสาขานี้ หรือถูกอัปเดตไปแล้ว' },
    };
  }

  const receipt = await repository.findReceipt({ id, branchId });
  return { status: 200, body: { success: true, receipt } };
};

module.exports = { execute };
