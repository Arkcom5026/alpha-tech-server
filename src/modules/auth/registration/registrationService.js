const registrationRepository = require('./registrationRepository');
const { bcryptHash } = require('../shared/passwordHasher');
const { buildAccessToken } = require('../shared/tokenFactory');
const {
  sha256,
  createPasswordResetToken,
  getPasswordResetExpiresAt,
  buildPasswordResetUrl,
} = require('../password/passwordTokenService');
const { sendRegistrationWelcomeEmail } = require('./registrationMailService');

const createTemporaryPassword = () => Math.random().toString(36).slice(-10) + 'A1!';

const registerStore = async ({ shopName, shopSlug, email, categoryId, req }) => {
  const existingUser = await registrationRepository.findUserByEmail(email);
  if (existingUser) return { conflict: 'EMAIL' };

  const existingBranch = await registrationRepository.findBranchBySlug(shopSlug);
  if (existingBranch) return { conflict: 'SLUG' };

  const rawPassword = createTemporaryPassword();
  const passwordHash = await bcryptHash(rawPassword, 10);
  const rawResetToken = createPasswordResetToken();
  const resetTokenHash = sha256(rawResetToken);
  const resetTokenExpiresAt = getPasswordResetExpiresAt();

  const created = await registrationRepository.createRegistration({
    shopName,
    shopSlug,
    email,
    passwordHash,
    categoryId,
    resetTokenHash,
    resetTokenExpiresAt,
  });

  console.log(
    `[auth.register] Success: Branch ${shopSlug} and Dual-Profile created with Category ID: ${categoryId}.`,
  );

  const resetUrl = buildPasswordResetUrl(req, rawResetToken);
  sendRegistrationWelcomeEmail({ shopName, shopSlug, email, rawPassword, resetUrl })
    .then(() => console.log(`✉️ [Register Mail] Sent welcome credentials successfully to: ${email}`))
    .catch((error) => console.error('❌ [Register Mail Failed]', error));

  const accessToken = buildAccessToken({
    ...created.user,
    employeeProfile: created.employeeProfile,
  });

  return {
    conflict: null,
    response: {
      token: accessToken,
      accessToken,
      role: created.user.role,
      profileType: 'employee',
      profile: {
        id: created.employeeProfile.id,
        name: created.employeeProfile.name,
        branch: created.branch,
        customerProfileId: created.customerProfile.id,
      },
    },
  };
};

module.exports = { registerStore };
