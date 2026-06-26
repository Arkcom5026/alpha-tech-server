// src/middlewares/tenantContext.js
const prisma = require('../database/prisma/client');
const AppError = require('../shared/errors/AppError');

async function tenantContext(req, res, next) {
  // รองรับการระบุ Tenant Slug ทั้งผ่าน HTTP Header และ Path URL Parameter เพื่อความอเนกประสงค์
  const tenantSlug = req.headers['x-tenant-slug'] || req.params.tenant_slug;

  if (!tenantSlug) {
    return next(new AppError('กรุณาระบุข้อมูลรหัสประจำสาขาร้านค้า (Tenant Slug is missing)', 400));
  }

  try {
    const branch = await prisma.branch.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        businessType: true,
        status: true
      }
    });

    if (!branch) {
      return next(new AppError('ไม่พบข้อมูลร้านสาขานี้ในสารบบจัดสรรพื้นที่ของระบบหลัก', 404));
    }

    if (branch.status === 'INACTIVE' || branch.status === 'SUSPENDED') {
      return next(new AppError('ร้านค้าสาขานี้อยู่ระหว่างการระงับการให้บริการชั่วคราว', 403));
    }

    // ผูกข้อมูลสาขาเข้าไปเป็นบริบทหลักในการดำเนินการของ API
    req.tenant = branch;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = tenantContext;