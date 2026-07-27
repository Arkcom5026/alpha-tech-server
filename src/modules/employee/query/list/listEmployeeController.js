const { listEmployeeProfiles } = require('./listEmployeeService');

const getAllEmployees = async (req, res) => {
  try {
    const result = await listEmployeeProfiles({ actor: req.user || {}, query: req.query || {} });
    return res.json(result);
  } catch (error) {
    console.error('❌ getAllEmployees error:', error);
    return res.status(500).json({ message: 'ดึงรายชื่อพนักงานไม่สำเร็จ' });
  }
};

module.exports = { getAllEmployees };
