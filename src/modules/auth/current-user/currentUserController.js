const currentUserService = require('./currentUserService');

const getMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const currentUser = await currentUserService.getCurrentEmployee(userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User or EmployeeProfile not found' });
    }

    return res.json(currentUser);
  } catch (error) {
    console.error('❌ getMe error:', error);
    return res.status(500).json({ message: 'Failed to verify session' });
  }
};

module.exports = { getMe };
