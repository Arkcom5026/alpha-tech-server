// controllers/employeeOnboardingController.js
// Canonical owner-created employee flow: create once and activate immediately.

const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');

const normalize = (value) => String(value || '').trim();
const normalizeEmail = (value) => normalize(value).toLowerCase();
const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const addSubEmployee = async (req, res) => {
  try {
    const branchId = toPositiveInt(req.user?.branchId || req.user?.employeeProfile?.branchId);
    if (!branchId) {
      return res.status(403).json({
        code: 'EMPLOYEE_ONBOARDING_BRANCH_REQUIRED',
        message: 'บัญชีผู้สร้างพนักงานไม่ได้ผูกกับสาขาที่ใช้งาน',
      });
    }

    const name = normalize(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const password = normalize(req.body?.password);
    const phone = normalize(req.body?.phone) || null;
    const v2Role = normalize(req.body?.v2Role).toUpperCase();
    const positionId = toPositiveInt(req.body?.positionId);

    if (!name || !email || !password || !v2Role || !positionId) {
      return res.status(400).json({
        code: 'EMPLOYEE_ONBOARDING_FIELDS_REQUIRED',
        message: 'กรุณากรอกชื่อ อีเมล รหัสผ่าน บทบาทในร้าน และตำแหน่งงานให้ครบถ้วน',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        code: 'EMPLOYEE_PASSWORD_TOO_SHORT',
        message: 'รหัสผ่านเริ่มต้นต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
      });
    }

    if (!['MANAGER', 'CASHIER'].includes(v2Role)) {
      return res.status(400).json({
        code: 'EMPLOYEE_STORE_ROLE_INVALID',
        message: 'บทบาทในร้านต้องเป็น MANAGER หรือ CASHIER',
      });
    }

    const [existingUser, position] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.position.findUnique({ where: { id: positionId }, select: { id: true, name: true } }),
    ]);

    if (existingUser) {
      return res.status(409).json({
        code: 'EMPLOYEE_EMAIL_ALREADY_EXISTS',
        message: 'อีเมลนี้ถูกลงทะเบียนใช้งานในระบบแล้ว',
      });
    }

    if (!position) {
      return res.status(400).json({
        code: 'EMPLOYEE_POSITION_NOT_FOUND',
        message: 'ไม่พบตำแหน่งงานที่เลือก กรุณาโหลดรายการตำแหน่งใหม่',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          loginId: email,
          password: passwordHash,
          role: 'EMPLOYEE',
          loginType: 'EMAIL',
          enabled: true,
        },
      });

      const employeeProfile = await tx.employeeProfile.create({
        data: {
          userId: user.id,
          branchId,
          positionId,
          name,
          phone,
          v2Role,
          approved: true,
          active: true,
        },
        include: { position: true, branch: true },
      });

      await tx.customerProfile.create({
        data: {
          userId: user.id,
          name,
          type: 'INDIVIDUAL',
        },
      });

      return { user, employeeProfile };
    });

    console.log(
      `👥 [Employee Onboarding] "${name}" created for Branch ID: ${branchId}, Position ID: ${positionId}`,
    );

    return res.status(201).json({
      ok: true,
      message: `สร้างบัญชีพนักงาน "${name}" สำเร็จและพร้อมใช้งานทันที`,
      data: {
        userId: created.user.id,
        employeeId: created.employeeProfile.id,
        name: created.employeeProfile.name,
        email: created.user.email,
        phone: created.employeeProfile.phone,
        v2Role: created.employeeProfile.v2Role,
        positionId: created.employeeProfile.positionId,
        position: created.employeeProfile.position,
        branchId: created.employeeProfile.branchId,
        branch: created.employeeProfile.branch,
        approved: created.employeeProfile.approved,
        active: created.employeeProfile.active,
        enabled: created.user.enabled,
      },
    });
  } catch (error) {
    console.error('❌ employee onboarding error:', error);
    return res.status(500).json({
      ok: false,
      code: 'EMPLOYEE_ONBOARDING_FAILED',
      message: 'ไม่สามารถสร้างบัญชีพนักงานได้ กรุณาลองใหม่อีกครั้ง',
    });
  }
};

module.exports = { addSubEmployee };
