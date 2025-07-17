// customerController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const bcrypt = require('bcryptjs');

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


const updateCustomerProfile = async (req, res) => {
  // ฟังก์ชันนี้สำหรับลูกค้าอัปเดตข้อมูลตัวเอง ไม่เกี่ยวกับสาขาของพนักงาน
  const userId = req.user.id;
  const { role } = req.user;

  if (role !== 'customer') {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' });
  }

  const {
    name,
    phone,
    address,
    district,
    province,
    postalCode,
  } = req.body;

  try {
    const updated = await prisma.customerProfile.update({
      where: { userId },
      data: { name, phone, address, district, province, postalCode },
    });

    res.json(updated);
  } catch (error) {
    console.error('🔥 updateCustomerProfile error:', error);
    res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลลูกค้าได้' });
  }
};

module.exports = {
  getCustomerByPhone,
  getCustomerByName,
  getCustomerByUserId,
  createCustomer,
  updateCustomerProfile,
};
