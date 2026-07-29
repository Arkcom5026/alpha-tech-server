const currentUserRepository = require('./currentUserRepository');

const getCurrentEmployee = async (userId) => {
  const user = await currentUserRepository.findEmployeeUserById(userId);
  if (!user || !user.employeeProfile) return null;

  const profile = user.employeeProfile;
  return {
    role: user.role,
    profileType: 'employee',
    branchId: profile.branchId || null,
    profile: {
      id: profile.id || null,
      name: profile.name || '',
      phone: profile.phone || '',
      email: user.email || '',
      branch: profile.branch || null,
      position: profile.position || null,
      branchId: profile.branchId || null,
      user: { id: user.id, email: user.email, role: user.role },
    },
  };
};

module.exports = { getCurrentEmployee };
