// src/middlewares/authGuard.js
const jwt = require('jsonwebtoken');
const AppError = require('../shared/errors/AppError');
const prisma = require('../database/prisma/client');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secure-jwt-secret';

async function protect(req, res, next) {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('กรุณาทำการเข้าสู่ระบบเพื่อรับสิทธิ์เข้าถึงส่วนนี้', 401));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const employee = await prisma.employee.findUnique({
      where: { id: decoded.id },
      include: { branch: true }
    });

    if (!employee || !employee.isActive) {
      return next(new AppError('สิทธิ์พนักงานของคุณถูกปฏิเสธหรือระงับการใช้งานในขณะนี้', 401));
    }

    // มาตรฐานความปลอดภัยสูงสุด: บังคับคัดกรองการข้ามเขตข้อมูลสาขา (Cross-Tenant)
    if (req.tenant && req.tenant.id !== employee.branchId) {
      return next(new AppError('คุณไม่ได้รับอนุญาตให้เข้าถึงข้อมูลภายนอกอาณาเขตสาขาของคุณ', 403));
    }

    req.employee = employee;
    next();
  } catch (error) {
    return next(new AppError('รหัสผ่านยืนยันสิทธิ์ความปลอดภัยไม่ถูกต้องหรือหมดระยะการใช้งาน', 401));
  }
}

function restrictTo(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.employee.role)) {
      return next(new AppError('คุณไม่มีระดับสิทธิ์การทำงานเพียงพอสำหรับการกระทำรายการนี้', 403));
    }
    next();
  };
}

module.exports = { protect, restrictTo };