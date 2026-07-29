const { sendMailAction } = require('../../../utils/mailSender');
const { PASSWORD_RESET_TOKEN_EXPIRES_MINUTES } = require('../password/passwordTokenService');

const sendRegistrationWelcomeEmail = ({ shopName, shopSlug, email, rawPassword, resetUrl }) => {
  const subject = `🔑 ข้อมูลบัญชีและลิงก์ตั้งค่ารหัสผ่านสำหรับร้าน ${shopName}`;
  const text = [
    `ยินดีต้อนรับคุณพาร์ตเนอร์ ร้าน ${shopName} ได้เปิดระบบบนแพลตฟอร์มเรียบร้อยแล้ว`,
    '',
    `อีเมลเข้าใช้งาน: ${email}`,
    `รหัสผ่านชั่วคราวของคุณคือ: ${rawPassword}`,
    '',
    'กรุณาคลิกลิงก์ด้านล่างนี้เพื่อกำหนดรหัสผ่านส่วนตัวใหม่ก่อนเริ่มใช้งานระบบจัดการหลังบ้าน:',
    `ลิงก์สำหรับตั้งรหัสผ่านใหม่: ${resetUrl}`,
    '',
    `ลิงก์ความปลอดภัยนี้จะหมดอายุภายใน ${PASSWORD_RESET_TOKEN_EXPIRES_MINUTES} นาที`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff;">
      <h2 style="color: #f97316; margin-bottom: 4px; font-weight: 900;">SADUAK<span style="color: #0f172a;">SABUY</span></h2>
      <p style="font-size: 11px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-top: 0;">Hyperlocal Market Platform</p>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
      <h3 style="margin-bottom: 16px; font-size: 18px; color: #0f172a; font-weight: 800;">🎉 ยินดีต้อนรับร่วมเป็นพันธมิตรคู่ค้า!</h3>
      <p>ระบบร้านค้า <strong>${shopName}</strong> (Shop Slug: <span style="font-family: monospace; color: #f97316;">${shopSlug}</span>) ได้รับการลงทะเบียนเปิดสิทธิ์ในระบบพอร์ทัลกลางเรียบร้อยแล้วครับ</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>อีเมลล็อกอิน:</strong> ${email}</p>
        <p style="margin: 0; font-size: 13px;"><strong>รหัสผ่านชั่วคราว:</strong> <span style="font-family: monospace; background-color: #cbd5e1; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #0f172a;">${rawPassword}</span></p>
      </div>
      <p style="font-size: 13px; color: #475569;">เพื่อความปลอดภัยสูงสุดของข้อมูลคลังและระบบ POS หลังร้าน กรุณากดปุ่มด้านล่างนี้เพื่อทำการ <strong>กำหนดรหัสผ่านส่วนตัวใหม่</strong> ของคุณก่อนเริ่มเข้าเซสชันจัดการบัญชีร้านค้าครับ:</p>
      <p style="margin: 32px 0; text-align: center;">
        <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(to right, #f97316, #f59e0b); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 13px; box-shadow: 0 10px 15px -3px rgba(249, 115, 22, 0.3);">ตั้งรหัสผ่านใหม่และเปิดใช้งานร้านค้า</a>
      </p>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="font-size: 11px; color: #94a3b8; margin: 0;">* ลิงก์ความปลอดภัยนี้จะหมดอายุภายใน ${PASSWORD_RESET_TOKEN_EXPIRES_MINUTES} นาที หากคุณไม่ได้เป็นผู้ส่งคำขอลงทะเบียนเปิดร้านค้า สามารถปล่อยละเว้นอีเมลฉบับนี้ได้ทันทีครับ</p>
    </div>
  `;

  return sendMailAction({ to: email, subject, text, html });
};

module.exports = { sendRegistrationWelcomeEmail };
