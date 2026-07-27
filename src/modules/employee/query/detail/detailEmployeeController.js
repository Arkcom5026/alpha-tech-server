const { getEmployeeProfileById } = require('./detailEmployeeService');

const getEmployeesById = async (req, res) => {
  try {
    const result = await getEmployeeProfileById({
      actor: req.user || {},
      employeeId: req.params.id,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ getEmployeeById error:', error);
    return res.status(500).json({ message: 'ดึงข้อมูลพนักงานไม่สำเร็จ' });
  }
};

module.exports = { getEmployeesById };
