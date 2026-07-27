const { listUsersByRole } = require('./usersByRoleService');

const getUsersByRole = async (req, res) => {
  try {
    const users = await listUsersByRole(req.query?.role);
    return res.json(users);
  } catch (error) {
    console.error('❌ getUsersByRole error:', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้' });
  }
};

module.exports = { getUsersByRole };
