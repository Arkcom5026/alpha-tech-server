const service = require('./updateEmployeeRoleService');

const updateUserRole = async (req, res) => {
  try {
    const result = await service.updateEmployeeUserRole({
      actor: req.user || {},
      userId: req.params.userId,
      role: req.body?.role,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[updateUserRole] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถเปลี่ยน Role ได้' });
  }
};

module.exports = { updateUserRole };
