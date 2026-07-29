const userLookupRepository = require('./userLookupRepository');

const findUserByEmail = async (email) => {
  const user = await userLookupRepository.findByEmail(email);
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.customerProfile?.name || '',
    phone: user.customerProfile?.phone || '',
    alreadyEmployee: !!user.employeeProfile,
  };
};

module.exports = { findUserByEmail };
