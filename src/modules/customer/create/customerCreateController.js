const customerCreateService = require('./customerCreateService');

async function createCustomer(req, res) {
  try {
    const result = await customerCreateService.createCustomer(req.body ?? {}, {
      branchId: Number(req.user?.branchId),
      employeeId: Number(req.user?.employeeId ?? req.user?.employeeProfileId),
    });
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    if (err?.statusCode && err?.payload) {
      return res.status(err.statusCode).json(err.payload);
    }

    console.error('❌ createCustomer error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างลูกค้า' });
  }
}

module.exports = { createCustomer };
