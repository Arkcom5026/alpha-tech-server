const service = require('./statusEmployeeService');

const toggleEmployeeStatus = async (req, res) => {
  try {
    const result = await service.changeEmployeeStatus({
      actor: req.user || {},
      employeeId: req.params.id,
      body: req.body || {},
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ toggleEmployeeStatus error:', error);
    return res.status(500).json({ message: 'เปลี่ยนสถานะพนักงานล้มเหลว' });
  }
};

module.exports = { toggleEmployeeStatus };
