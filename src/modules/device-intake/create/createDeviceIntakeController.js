const service = require('./createDeviceIntakeService');

async function createDeviceIntake(req, res, next) {
  try {
    const data = await service.execute(
      {
        branchId: req.user?.branchId,
        employeeId: req.user?.employeeId,
        role: req.user?.v2Role,
      },
      req.body || {},
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    return res.status(201).json({
      success: true,
      message: 'สร้างรายการรับอุปกรณ์เรียบร้อยแล้ว',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createDeviceIntake };
