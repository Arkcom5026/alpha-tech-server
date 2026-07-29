const { prisma } = require('../../../lib/prisma');

const includeProfiles = {
  customerProfile: true,
  employeeProfile: { include: { branch: true, position: true } },
};

const findByEmail = (email) => prisma.user.findUnique({
  where: { email },
  include: includeProfiles,
});

const findByLoginId = (loginId) => prisma.user.findFirst({
  where: { loginId },
  include: includeProfiles,
});

const findEmployeeProfileUserIdByPhone = async (phone) => {
  const employeeProfile = await prisma.employeeProfile.findFirst({
    where: { phone },
    select: { userId: true },
  });

  return employeeProfile?.userId || null;
};

const findById = (id) => prisma.user.findUnique({
  where: { id },
  include: includeProfiles,
});

module.exports = {
  findByEmail,
  findByLoginId,
  findEmployeeProfileUserIdByPhone,
  findById,
};
