// customerController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

// 🔧 helper: กันการเขียนทับด้วย undefined
const omitUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

const getCustomerByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    const { branchId } = req.user; // ✅ อ่าน branchId จาก token

    // ✅ กรองลูกค้า: ต้องเคยมีประวัติการซื้อที่สาขานี้เท่านั้น
    const customer = await prisma.customerProfile.findFirst({
      where: {
        phone: phone,
        sale: {
          some: {
            branchId: Number(branchId),
          },
        },
      },
      include: { user: true },
    });

    if (!customer) {
      return res.status(404).json({ message: 'ไม่พบลูกค้า หรือลูกค้าไม่มีประวัติที่สาขานี้' });
    }

    return res.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      email: customer.user?.email || '',
      type: customer.type,
      companyName: customer.companyName,
      taxId: customer.taxId,
      creditLimit: customer.creditLimit,
      creditBalance: customer.creditBalance,
    });
  } catch (err) {
    console.error('[getCustomerByPhone] ❌', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้า' });
  }
};

const getCustomerByName = async (req, res) => {
  try {
    const { q } = req.query;
    const { branchId } = req.user; // ✅ อ่าน branchId จาก token

    if (!q) {
      return res.json([]);
    }

    // ✅ กรองลูกค้า: ต้องเคยมีประวัติการซื้อที่สาขานี้เท่านั้น
    const customers = await prisma.customerProfile.findMany({
      where: {
        name: {
          contains: q,
          mode: 'insensitive',
        },
        sale: {
          some: {
            branchId: Number(branchId),
          },
        },
      },
      take: 10,
      include: { user: true },
    });

    console.log('getCustomerByName : ', customers);

    return res.json(
      customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        email: c.user?.email || '',
        type: c.type,
        companyName: c.companyName,
        taxId: c.taxId,
        creditLimit: c.creditLimit,
        creditBalance: c.creditBalance,
      }))
    );
  } catch (err) {
    console.error('[getCustomerByName] ❌', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาด้วยชื่อ' });
  }
};

const getCustomerByUserId = async (req, res) => {
  try {
    // ฟังก์ชันนี้สำหรับลูกค้าดูข้อมูลตัวเอง ไม่เกี่ยวกับสาขาของพนักงาน
    const userId = req.user.id;
    const { role } = req.user;

    if (role !== 'customer') {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' });
    }

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!customer) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้าในระบบ' });
    }

    return res.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      district: customer.district,
      province: customer.province,
      postalCode: customer.postalCode,
      email: customer.user?.email || '',
    });
  } catch (err) {
    console.error('[getCustomerByUserId] ❌', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า' });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { branchId } = req.user; // ✅ อ่าน branchId จาก token
    const { name, phone, email, address, type, companyName, taxId } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ error: 'ต้องระบุชื่อและเบอร์โทร' });
    }

    const existing = await prisma.customerProfile.findFirst({ where: { phone } });
    if (existing) {
      return res.status(409).json({ error: 'เบอร์นี้ถูกลงทะเบียนแล้ว' });
    }

    // ✅ หมายเหตุ: การสร้างลูกค้าเป็นการสร้างข้อมูลแบบ Global ตาม Schema
    // แต่การกระทำนี้ถูกบันทึกโดยพนักงานจากสาขา ID: ${branchId}
    // ลูกค้าใหม่จะยังไม่ปรากฏในการค้นหาจนกว่าจะมีการซื้อครั้งแรกที่สาขานั้นๆ
    const rawPassword = phone.slice(-4);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        email: email || null,
        loginId: phone,
        password: hashedPassword,
        role: 'customer',
        loginType: 'PHONE',
      },
    });

    const newCustomer = await prisma.customerProfile.create({
      data: {
        name,
        phone,
        address: address || null,
        userId: newUser.id,
        type: type || 'INDIVIDUAL',
        companyName: companyName || null,
        taxId: taxId || null,
      },
    });

    return res.status(201).json(newCustomer);
  } catch (err) {
    console.error('[createCustomer] ❌', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างลูกค้า' });
  }
};



// POS-side: staff updates any customer's profile (RBAC + branch scope)
const updateCustomerProfile = async (req, res) => {
  try {
    const actor = req.user;
    if (!actor) {
      console.warn('[me-pos] UNAUTHENTICATED request — missing req.user');
      return res.status(401).json({ message: 'UNAUTHENTICATED: missing user context' });
    }
    console.log('[me-pos] actor =', { id: actor.id, role: actor.role, branchId: actor.branchId });
    // 🔐 Accept both "staff" and "employee" (normalize to lowercase)
    const role = String(actor.role || '').toLowerCase();
    const STAFF_ROLES = new Set(['admin', 'manager', 'staff', 'employee']);
    if (!STAFF_ROLES.has(role)) {
      return res.status(403).json({ message: 'FORBIDDEN_ROLE: staff/employee only' });
    }

    const {
      id,
      userId, // ลูกค้าที่มาจาก Online
      email, // ถ้ามี ต้องอัปเดตที่ตาราง user
      phone,
      name,
      address,
      district,
      province,
      postalCode,
      companyName,
      taxId,
    } = req.body ?? {};

    // 1) ระบุตัวลูกค้าให้ชัด (รองรับหลายกรณี)
    const orConds = [];
    if (id !== undefined && id !== null && !Number.isNaN(Number(id))) orConds.push({ id: Number(id) });
    if (userId) orConds.push({ userId });
    if (phone) orConds.push({ phone });
    if (email) orConds.push({ user: { email } }); // ค้นผ่าน relation

    if (orConds.length === 0) {
      return res.status(400).json({ message: 'ต้องระบุ id หรือ userId หรือ email/phone อย่างน้อยหนึ่งค่า' });
    }

    // 2) ดึงโปรไฟล์ก่อน เพื่อเช็คสิทธิ์/สาขา และเตรียมอัปเดต
    const target = await prisma.customerProfile.findFirst({
      where: { OR: orConds },
      include: { user: true },
    });

    if (!target) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า' });
    }

    // 3) ป้องกันการใช้บัญชีพนักงานเป็นลูกค้า / และห้ามขายให้ตัวเอง
    const targetRole = String(target.user?.role || '').toLowerCase();
    if (STAFF_ROLES.has(targetRole)) {
      return res.status(403).json({ message: 'FORBIDDEN_TARGET: ไม่อนุญาตให้ใช้บัญชีพนักงานเป็นลูกค้า POS' });
    }
    if (target.userId && Number(target.userId) === Number(actor.id)) {
      return res.status(403).json({ message: 'FORBIDDEN_SELF_SALE: พนักงานห้ามขายให้ตัวเอง' });
    }

    // 4) บังคับใช้ BRANCH_SCOPE_ENFORCED (ถ้า schema มี branchId)
    if (Object.prototype.hasOwnProperty.call(target, 'branchId')) {
      if (actor.branchId && target.branchId && actor.branchId !== target.branchId) {
        return res.status(403).json({ message: 'ข้ามสาขาไม่ได้ (BRANCH_SCOPE_ENFORCED)' });
      }
    }

    // 4) เตรียมข้อมูลอัปเดต (เฉพาะ field ที่อนุญาต)
    const profileData = omitUndefined({
      name,
      phone,
      address,
      district,
      province,
      postalCode,
      companyName,
      taxId,
    });

    // 5) อัปเดตภายใน transaction — ถ้ามี email ให้ไปอัปเดตที่ตาราง user
    const updated = await prisma.$transaction(async (tx) => {
      const upd = await tx.customerProfile.update({
        where: { id: target.id },
        data: profileData,
      });

      if (email && target.userId) {
        await tx.user.update({ where: { id: target.userId }, data: { email } });
      }

      return upd;
    });

    const customerAddress = [
      updated.address,
      updated.district,
      updated.province,
      updated.postalCode,
    ]
      .filter(Boolean)
      .join(' ');

    return res.status(200).json({
      ...updated,
      email: email ?? target.user?.email ?? null,
      customerAddress,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('P2025')) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า (P2025)' });
    }
    console.error('❌ [updateCustomerProfile] error:', message);
    return res.status(500).json({ message: 'Failed to update customer profile' });
  }
};





// Online-side: customer self-updates own profile (upsert + user.email update)
const updateCustomerProfileOnline = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'customer') {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' });
    }

    const { name, email, phone, address, district, province, postalCode, companyName, taxId } = req.body ?? {};

    const profileData = omitUndefined({
      name,
      phone,
      address,
      district,
      province,
      postalCode,
      companyName,
      taxId,
    });

    // เช็คว่ามีโปรไฟล์อยู่แล้วหรือยัง
    const existing = await prisma.customerProfile.findUnique({
      where: { userId: user.id },
      include: { user: true },
    });

    const updated = await prisma.$transaction(async (tx) => {
      let upd;
      if (existing) {
        upd = await tx.customerProfile.update({ where: { id: existing.id }, data: profileData });
      } else {
        upd = await tx.customerProfile.create({ data: { userId: user.id, ...profileData } });
      }

      // อัปเดต email ที่ตาราง user กรณีผู้ใช้ต้องการเปลี่ยนอีเมล
      if (email) {
        await tx.user.update({ where: { id: user.id }, data: { email } });
      }

      return upd;
    });

    const customerAddress = [
      updated.address,
      updated.district,
      updated.province,
      updated.postalCode,
    ].filter(Boolean).join(' ');

    return res.status(200).json({
      ...updated,
      email: email ?? existing?.user?.email ?? user.email ?? null,
      customerAddress,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('P2025')) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า (P2025)' });
    }
    console.error('❌ [updateCustomerProfileOnline] error:', message);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
};

module.exports = {
  getCustomerByPhone,
  getCustomerByName,
  getCustomerByUserId,
  createCustomer,
  updateCustomerProfile,
  updateCustomerProfileOnline,
};
