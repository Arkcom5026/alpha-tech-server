const { createEmployeeService } = require('./createEmployeeService');

const createEmployeeController = async (req, res) => {
  try {
    const employee = await createEmployeeService({ actor: req.user || {}, payload: req.body || {} });
    return res.status(201).json(employee);
  } catch (error) {
    console.error('❌ createEmployeeController error:', error);
    return res.status(error.statusCode || 400).json({
      message: error.message || 'สร้างพนักงานไม่สำเร็จ',
    });
  }
};

module.exports = { createEmployeeController };
