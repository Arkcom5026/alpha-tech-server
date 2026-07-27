const { updateEmployeeService } = require('./updateEmployeeService');

const updateEmployeeController = async (req, res) => {
  try {
    const employee = await updateEmployeeService({
      actor: req.user || {},
      employeeId: req.params.id,
      payload: req.body || {},
    });
    return res.json(employee);
  } catch (error) {
    console.error('❌ updateEmployeeController error:', error);
    return res.status(error.statusCode || 400).json({ message: error.message || 'แก้ไขพนักงานล้มเหลว' });
  }
};

module.exports = { updateEmployeeController };
