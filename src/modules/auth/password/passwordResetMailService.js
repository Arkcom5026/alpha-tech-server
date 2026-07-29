const { sendMailAction } = require('../../../utils/mailSender');
const { PASSWORD_RESET_TOKEN_EXPIRES_MINUTES } = require('./passwordTokenService');

const sendPasswordResetEmail = async ({ toEmail, resetUrl }) => {
  if (!toEmail) throw new Error('Recipient email is required for password reset');
  if (!resetUrl) throw new Error('Password reset URL is required');

  const subject = 'ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ';
  const text = [
    'เราได้รับคำขอให้ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ',
    '',
    `ลิงก์สำหรับตั้งรหัสผ่านใหม่: ${resetUrl}`,
    '',
    `ลิงก์นี้จะหมดอายุใน ${PASSWORD_RESET_TOKEN_EXPIRES_MINUTES} นาที`,
    'หากคุณไม่ได้เป็นผู้ส่งคำขอนี้ คุณสามารถละเว้นอีเมลฉบับนี้ได้',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a; max-width: 560px; margin: 0 auto;">
      <h2 style="margin-bottom: 12px;">ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</h2>
      <p>เราได้รับคำขอให้ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 20px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600;">ตั้งรหัสผ่านใหม่</a>
      </p>
      <p>หากปุ่มด้านบนไม่ทำงาน คุณสามารถคัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์ได้:</p>
      <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
      <p>ลิงก์นี้จะหมดอายุใน ${PASSWORD_RESET_TOKEN_EXPIRES_MINUTES} นาที</p>
      <p style="color: #475569;">หากคุณไม่ได้เป็นผู้ส่งคำขอนี้ คุณสามารถละเว้นอีเมลฉบับนี้ได้</p>
    </div>
  `;

  return sendMailAction({ to: toEmail, subject, text, html });
};

module.exports = { sendPasswordResetEmail };