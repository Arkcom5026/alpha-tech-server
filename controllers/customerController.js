
// customerController.js — aligned with CartController style (Prisma import, helpers, transactions)

const { prisma, Prisma } = require('../lib/prisma');
const bcrypt = require('bcryptjs');

// Helpers
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const omitUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// 📞 phone helpers
const normalizePhone = (raw = '') => String(raw).replace(/\D/g, '').replace(/^66/, '0').slice(-10);
const isValidPhone = (s = '') => /^\d{10}$/.test(s);

// 🏠 address helper — รวมเป็นสตริงให้ FE
const buildCustomerAddress = (profile) => {
  const parts = [];
  if (profile?.addressDetail) parts.push(profile.addressDetail);
  const sd = profile?.subdistrict;
  const d = sd?.district;
  const pv = d?.province;
  if (sd?.nameTh) parts.push(sd.nameTh);
  if (d?.nameTh) parts.push(d.nameTh);
  if (pv?.nameTh) parts.push(pv.nameTh);
  const postcode = sd?.postcode || profile?.postalCode || null;
  if (postcode) parts.push(postcode);
  return parts.filter(Boolean).join(' ');
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customers/by-phone/:phone
const getCustomerByPhone = async (req, res) => {
  try {
    // 🔒 BRANCH_SCOPE_ENFORCED: ต้องมี branchId เสมอ เพื่อกัน query หลุด scope
    const branchId = toInt(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'Unauthorized (missing branchId)' });

    const phone = normalizePhone(req.params.phone);
    if (!isValidPhone(phone)) return res.status(400).json({ message: 'รูปแบบเบอร์โทรไม่ถูกต้อง' });

    const customer = await prisma.customerProfile.findFirst({
      where: {
        user: { loginId: phone },
        sale: { some: { branchId } },
      },
      include: { user: true, subdistrict: { include: { district: { include: { province: true } } } } },
    });

    if (!customer) return res.status(404).json({ message: 'ไม่พบลูกค้า' });

    return res.json({
      id: customer.id,
      name: customer.name,
      phone: customer.user?.loginId || null,
      subdistrictCode: customer.subdistrict?.code || null,
      addressDetail: customer.addressDetail || null,
      email: '', // POS policy: ไม่รับ/ไม่เก็บ email
      type: customer.type,
      companyName: customer.companyName,
      taxId: customer.taxId,
      postcode: customer.subdistrict?.postcode || null,
      creditLimit: customer.creditLimit,
      creditBalance: customer.creditBalance,
      customerAddress: buildCustomerAddress(customer),
    });
  } catch (err) {
    console.error('❌ getCustomerByPhone error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้า' });
  }
};

// GET /api/customers/search?q=
const getCustomerByName = async (req, res) => {
  try {
    // 🔒 BRANCH_SCOPE_ENFORCED: ต้องมี branchId เสมอ เพื่อกัน query หลุด scope
    const branchId = toInt(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'Unauthorized (missing branchId)' });

    const q = String(req.query?.q || '').trim();
    if (!q) return res.json([]);

    const customers = await prisma.customerProfile.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' },
        sale: { some: { branchId } },
      },
      take: 10,
      include: { user: true, subdistrict: { include: { district: { include: { province: true } } } } },
    });

    return res.json(
      customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.user?.loginId || null,
        subdistrictCode: c.subdistrict?.code || null,
        addressDetail: c.addressDetail || null,
        email: '', // POS policy: ไม่รับ/ไม่เก็บ email
        type: c.type,
        companyName: c.companyName,
        taxId: c.taxId,
        creditLimit: c.creditLimit,
        creditBalance: c.creditBalance,
        postcode: c.subdistrict?.postcode || null,
        customerAddress: buildCustomerAddress(c),
      }))
    );
  } catch (err) {
    console.error('❌ getCustomerByName error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้า' });
  }
};

// GET /api/customers/me
async function getCustomerByUserId(req, res) {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (role !== 'CUSTOMER') return res.status(403).json({ message: 'Forbidden' });

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: true, subdistrict: { include: { district: { include: { province: true } } } } },
    });

    if (!customer) return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า' });

    return res.json({
      id: customer.id,
      name: customer.name,
      phone: customer.user?.loginId || null,
      email: '', // POS policy: ไม่รับ/ไม่เก็บ email
      subdistrictCode: customer.subdistrict?.code || null,
      addressDetail: customer.addressDetail || null,
      companyName: customer.companyName,
      taxId: customer.taxId,
      postcode: customer.subdistrict?.postcode || null,
      customerAddress: buildCustomerAddress(customer),
    });
  } catch (err) {
    console.error('❌ getCustomerByUserId error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า' });
  }
}


// POST /api/customers
const createCustomer = async (req, res) => {
  try {
    const { name, phone, type, companyName, taxId, subdistrictCode, addressDetail } = req.body ?? {};
    // POS policy: ignore email from client

    const normalizedPhone = normalizePhone(phone);

    if (!name || !isValidPhone(normalizedPhone)) {
      return res.status(400).json({ error: 'ต้องระบุชื่อและเบอร์โทร (10 หลัก)' });
    }

    const existingUser = await prisma.user.findUnique({ where: { loginId: normalizedPhone } });

    // 🔒 กันผูก CustomerProfile ให้ User ผิดประเภท (เช่น EMPLOYEE)
    if (existingUser && existingUser.role !== 'CUSTOMER') {
      return res.status(409).json({ message: 'เบอร์นี้ถูกใช้ในบัญชีประเภทอื่นแล้ว' });
    }
    if (existingUser && existingUser.loginType && existingUser.loginType !== 'PHONE') {
      return res.status(409).json({ message: 'เบอร์นี้ถูกใช้กับวิธีล็อกอินอื่นแล้ว' });
    }

    // ✅ Idempotent: มีอยู่แล้วให้คืนตัวเดิม (ไม่ throw)
    if (existingUser) {
      const existingProfile = await prisma.customerProfile.findFirst({
        where: { userId: existingUser.id },
        include: { user: true, subdistrict: { include: { district: { include: { province: true } } } } },
      });
      if (existingProfile) {
        return res.json({
          id: existingProfile.id,
          name: existingProfile.name,
          phone: existingProfile.user?.loginId || null,
          subdistrictCode: existingProfile.subdistrict?.code || null,
          addressDetail: existingProfile.addressDetail || null,
          email: '', // POS policy: ไม่รับ/ไม่เก็บ email
          type: existingProfile.type,
          companyName: existingProfile.companyName,
          taxId: existingProfile.taxId,
          postcode: existingProfile.subdistrict?.postcode || null,
          creditLimit: existingProfile.creditLimit,
          creditBalance: existingProfile.creditBalance,
          customerAddress: buildCustomerAddress(existingProfile),
        });
      }
    }

    const rawPassword = normalizedPhone.slice(-4);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // ตรวจสอบความสอดคล้องของ postcode กับ subdistrictCode (ถ้ามีส่งมา)
    const clientPostcode = (req.body?.postalCode ?? req.body?.postcode)
      ? String(req.body?.postalCode ?? req.body?.postcode)
      : undefined;

    if (typeof subdistrictCode === 'string' && subdistrictCode) {
      const sd = await prisma.subdistrict.findUnique({ where: { code: subdistrictCode }, select: { postcode: true } });
      if (!sd) return res.status(400).json({ message: 'รหัสตำบลไม่ถูกต้อง' });
      if (clientPostcode && String(sd.postcode) !== clientPostcode) {
        return res.status(400).json({ message: 'รหัสไปรษณีย์ไม่ตรงกับตำบลที่เลือก', expectedPostcode: sd.postcode });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = existingUser
        ? existingUser
        : await tx.user.create({
          data: {
            email: null, // 🔒 baseline A: ไม่ใช้ User.email
            loginId: normalizedPhone,
            password: hashedPassword,
            role: 'CUSTOMER',
            loginType: 'PHONE',
          },
        });

      const profile = await tx.customerProfile.create({
        data: {
          name,
          userId: user.id,
          type: type || 'INDIVIDUAL',
          companyName: companyName || null,
          taxId: taxId || null,
          addressDetail: typeof addressDetail === 'string' ? addressDetail.trim() : null,
          ...(subdistrictCode ? { subdistrictCode } : {}),
        },
        include: { user: true, subdistrict: { include: { district: { include: { province: true } } } } },
      });

      return profile;
    });

    return res.status(201).json({
      id: result.id,
      name: result.name,
      phone: result.user?.loginId || null,
      email: '', // POS policy: ไม่รับ/ไม่เก็บ email
      type: result.type,
      companyName: result.companyName,
      taxId: result.taxId,
      subdistrictCode: result.subdistrict?.code || null,
      addressDetail: result.addressDetail || null,
      postcode: result.subdistrict?.postcode || null,
      customerAddress: buildCustomerAddress(result),
      creditLimit: result.creditLimit,
      creditBalance: result.creditBalance,
    });
  } catch (err) {
    console.error('❌ createCustomer error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างลูกค้า' });
  }
};

// PUT /api/customers/:id
const updateCustomerProfile = async (req, res) => {
  try {
    const userCtx = req.user || {};
    const role = userCtx.role || '';
    const branchId = toInt(userCtx.branchId);

    if (!userCtx.id) return res.status(401).json({ message: 'Unauthorized' });
    if (!['SUPERADMIN', 'ADMIN', 'EMPLOYEE'].includes(role)) return res.status(403).json({ message: 'Forbidden' });

    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'รหัสลูกค้าไม่ถูกต้อง' });

    const { name, phone, type, companyName, taxId, subdistrictCode, addressDetail } = req.body ?? {};
    // POS policy: ignore email from client


    if (typeof type !== 'undefined') {
      const ALLOWED = new Set(['INDIVIDUAL', 'ORGANIZATION', 'GOVERNMENT']);
      if (!ALLOWED.has(type)) return res.status(400).json({ message: 'ประเภทลูกค้าไม่ถูกต้อง' });
    }

    const sanitize = (v) => (typeof v === 'string' ? v.trim() : v);

    const existing = await prisma.customerProfile.findUnique({ where: { id }, include: { user: true } });
    if (!existing) return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า' });

    // (คง logic เดิมไว้ ถ้า schema มี branchId จริงก็ยังใช้ได้)
    if (existing.branchId && branchId && existing.branchId !== branchId && role !== 'SUPERADMIN') {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์แก้ไขลูกค้าสาขาอื่น' });
    }

    const profileData = Object.fromEntries(
      Object.entries({
        name: sanitize(name),
        type,
        companyName: sanitize(companyName),
        taxId: sanitize(taxId),
        addressDetail: sanitize(addressDetail),
      }).filter(([, v]) => v !== undefined)
    );

    // ตรวจสอบความสอดคล้องของ postcode กับ subdistrictCode (ถ้ามีส่งมา)
    const clientPostcode = (req.body?.postalCode ?? req.body?.postcode)
      ? String(req.body?.postalCode ?? req.body?.postcode)
      : undefined;

    if (typeof subdistrictCode === 'string' && subdistrictCode) {
      const sd = await prisma.subdistrict.findUnique({
        where: { code: subdistrictCode },
        select: { postcode: true },
      });
      if (!sd) return res.status(400).json({ message: 'รหัสตำบลไม่ถูกต้อง' });
      if (clientPostcode && String(sd.postcode) !== clientPostcode) {
        return res.status(400).json({
          message: 'รหัสไปรษณีย์ไม่ตรงกับตำบลที่เลือก',
          expectedPostcode: sd.postcode,
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      // POS policy: ไม่รับ/ไม่เก็บ email (schema ไม่มี customerProfile.email)
      await tx.customerProfile.update({
        where: { id },
        data: {
          ...profileData,
          ...(subdistrictCode !== undefined
            ? { subdistrictCode: subdistrictCode || null }
            : {}),
        },
      });


      // phone (loginId) ยังอยู่ที่ User ตามโครงสร้างเดิม
      if (phone) {
        const newPhone = normalizePhone(phone);
        if (!isValidPhone(newPhone)) throw new Error('INVALID_PHONE');
        await tx.user.update({ where: { id: existing.userId }, data: { loginId: newPhone } });
      }
    });

    const full = await prisma.customerProfile.findUnique({
      where: { id },
      include: { user: true, subdistrict: { include: { district: { include: { province: true } } } } },
    });

    return res.json({
      id: full.id,
      name: full.name,
      type: full.type,
      companyName: full.companyName,
      taxId: full.taxId,
      subdistrictCode: full.subdistrict?.code || null,
      addressDetail: full.addressDetail,
      postcode: full.subdistrict?.postcode || null,
      customerAddress: buildCustomerAddress(full),
      phone: full.user?.loginId || null,
      email: '', // POS policy: ไม่รับ/ไม่เก็บ email
    });
  } catch (e) {
    if (e && e.code === 'P2002') return res.status(409).json({ message: 'ข้อมูลซ้ำกัน' });
    if (e && e.message === 'INVALID_PHONE') return res.status(400).json({ message: 'รูปแบบเบอร์โทรไม่ถูกต้อง' });
    console.error('❌ updateCustomerProfile error:', e);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตลูกค้า' });
  }
};



// PUT /api/customers/me
const updateCustomerProfileOnline = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'CUSTOMER') return res.status(403).json({ message: 'Forbidden' });

    const { name, phone, type, companyName, taxId, subdistrictCode, addressDetail } = req.body ?? {};
    // POS policy: ignore email from client

    if (typeof type !== 'undefined') {
      const ALLOWED = new Set(['INDIVIDUAL', 'ORGANIZATION', 'GOVERNMENT']);
      if (!ALLOWED.has(type)) return res.status(400).json({ message: 'ประเภทลูกค้าไม่ถูกต้อง' });
    }

    const profileData = omitUndefined({ name, type, companyName, taxId, addressDetail });

    const clientPostcode = (req.body?.postalCode ?? req.body?.postcode)
      ? String(req.body?.postalCode ?? req.body?.postcode)
      : undefined;

    if (typeof subdistrictCode === 'string' && subdistrictCode) {
      const sd = await prisma.subdistrict.findUnique({
        where: { code: subdistrictCode },
        select: { postcode: true },
      });
      if (!sd) return res.status(400).json({ message: 'รหัสตำบลไม่ถูกต้อง' });
      if (clientPostcode && String(sd.postcode) !== clientPostcode) {
        return res.status(400).json({
          message: 'รหัสไปรษณีย์ไม่ตรงกับตำบลที่เลือก',
          expectedPostcode: sd.postcode,
        });
      }
    }

    const existing = await prisma.customerProfile.findUnique({ where: { userId: user.id }, include: { user: true } });

    const updated = await prisma.$transaction(async (tx) => {
      const emailPatch = {}; // POS policy: ไม่รับ/ไม่เก็บ email (schema ไม่มี customerProfile.email)


      let upd;
      if (existing) {
        upd = await tx.customerProfile.update({
          where: { id: existing.id },
          data: {
            ...profileData,
            ...emailPatch,
            ...(subdistrictCode !== undefined
              ? { subdistrictCode: subdistrictCode || null }
              : {}),
          },
        });
      } else {
        upd = await tx.customerProfile.create({
          data: {
            userId: user.id,
            ...profileData,
            ...emailPatch,
            ...(subdistrictCode ? { subdistrictCode } : {}),
          },
        });
      }

      // phone (loginId) ยังอยู่ที่ User ตามโครงสร้างเดิม
      if (phone) {
        const newPhone = normalizePhone(phone);
        if (!isValidPhone(newPhone)) throw new Error('INVALID_PHONE');
        await tx.user.update({ where: { id: user.id }, data: { loginId: newPhone } });
      }

      return upd;
    });

    const full = await prisma.customerProfile.findUnique({
      where: { id: updated.id },
      include: { user: true, subdistrict: { include: { district: { include: { province: true } } } } },
    });

    return res.json({
      id: full.id,
      name: full.name,
      type: full.type,
      companyName: full.companyName,
      taxId: full.taxId,
      subdistrictCode: full.subdistrict?.code || null,
      addressDetail: full.addressDetail,
      customerAddress: buildCustomerAddress(full),
      phone: full.user?.loginId || null,
      email: '', // POS policy: ไม่รับ/ไม่เก็บ email

    });
  } catch (err) {
    if (err && err.message === 'INVALID_PHONE') return res.status(400).json({ message: 'รูปแบบเบอร์โทรไม่ถูกต้อง' });
    console.error('❌ updateCustomerProfileOnline error:', err);
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




