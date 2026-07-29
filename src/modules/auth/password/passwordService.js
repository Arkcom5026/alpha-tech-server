const passwordRepository = require('./passwordRepository');
const { bcryptHash } = require('../shared/passwordHasher');
const {
  sha256,
  createPasswordResetToken,
  getPasswordResetExpiresAt,
  buildPasswordResetUrl,
} = require('./passwordTokenService');
const { sendPasswordResetEmail } = require('./passwordResetMailService');

const GENERIC_SUCCESS_MESSAGE = 'หากข้อมูลของคุณมีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่แล้ว';

const requestPasswordReset = async ({ email, req }) => {
  const user = await passwordRepository.findEnabledUserByEmail(email);
  if (!user || !user.enabled) return { message: GENERIC_SUCCESS_MESSAGE };

  const rawToken = createPasswordResetToken();
  const tokenHash = sha256(rawToken);
  const expiresAt = getPasswordResetExpiresAt();
  const resetUrl = buildPasswordResetUrl(req, rawToken);

  await passwordRepository.replaceActiveResetToken({ userId: user.id, tokenHash, expiresAt });

  try {
    await sendPasswordResetEmail({ toEmail: user.email, resetUrl });
  } catch (cause) {
    const error = new Error('Password reset email delivery failed');
    error.code = 'PASSWORD_RESET_MAIL_FAILED';
    error.cause = cause;
    throw error;
  }

  return { message: GENERIC_SUCCESS_MESSAGE };
};

const resetPassword = async ({ rawToken, password }) => {
  const tokenHash = sha256(rawToken);
  const resetRecord = await passwordRepository.findValidResetToken(tokenHash);

  if (!resetRecord || !resetRecord.user?.enabled) {
    return { invalid: true };
  }

  const passwordHash = await bcryptHash(password, 10);
  await passwordRepository.resetPasswordAndInvalidateTokens({
    resetRecordId: resetRecord.id,
    userId: resetRecord.user.id,
    passwordHash,
  });

  return { invalid: false };
};

module.exports = {
  GENERIC_SUCCESS_MESSAGE,
  requestPasswordReset,
  resetPassword,
};