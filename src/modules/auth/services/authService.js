// src/modules/auth/services/authService.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../../database/prisma/client');
const AppError = require('../../../shared/errors/AppError');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secure-jwt-secret';
const JWT_EXPIRES_IN = '8h';

class AuthService {
  async login(email, password, tenantSlug) {
    const employee = await prisma.employee.findUnique({
      where: { email },
      include: { branch: true }
    });

    if (!employee || !employee.isActive) {
      throw new AppError('ระบุข้อมูลบัญชีใช้งานผู้ใช้ไม่ถูกต้องหรือพนักงานถูกระงับสิทธิ์', 401);
    }

    // ตรวจสอบบริบทให้มั่นใจว่าไม่ได้ทำงานสลักในสาขาอื่น
    if (employee.branch.slug !== tenantSlug) {
      throw new AppError('บัญชีผู้ใช้ของคุณไม่มีระดับขอบเขตการทำงานร่วมกับสาขานี้', 403);
    }

    const isPasswordCorrect = await bcrypt.compare(password, employee.passwordHash);
    if (!isPasswordCorrect) {
      throw new AppError('ระบุข้อมูลบัญชีใช้งานผู้ใช้ไม่ถูกต้อง (รหัสผ่านผิดพลาด)', 401);
    }

    const token = jwt.sign(
      { 
        id: employee.id, 
        role: employee.role, 
        branchId: employee.branchId, 
        tenantSlug: employee.branch.slug 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      token,
      employee: {
        id: employee.id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: employee.role,
        branch: {
          id: employee.branch.id,
          name: employee.branch.name
        }
      }
    };
  }
}

module.exports = new AuthService();