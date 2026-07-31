const service = require('./customerSelfUpdateService');

const updateCustomerSelf = async (req, res) => {
  try {
    const result = await service.updateCustomerSelf({
      user: req.user,
      body: req.body ?? {},
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ updateCustomerSelf error:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
};

module.exports = { updateCustomerSelf };
