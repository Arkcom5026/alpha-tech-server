const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

// ✅ ค้นหาลูกค้าจากเบอร์โทร
const getCustomerByPhone = async (req, res) => {
  try {
    const { phone } = req.params;

    const customer = await prisma.customerProfile.findFirst({
      where: { phone },
      include: { user: true },
    });

    if (!customer) {
      return res.status(404).json({ message: 'ไม่พบลูกค้า' });
    }

    return res.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      email: customer.user?.email || '',
    });
  } catch (err) {
    console.error('[getCustomerByPhone] ❌', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้า' });
  }
};

// ✅ ค้นหาลูกค้าด้วย userId
const getCustomerByUserId = async (req, res) => {
  try {
    const userId = req.user.id;

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

// ✅ สร้างลูกค้าใหม่ พร้อมสร้าง User + CustomerProfile
const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ error: 'ต้องระบุชื่อและเบอร์โทร' });
    }

    const existing = await prisma.customerProfile.findFirst({ where: { phone } });
    if (existing) {
      return res.status(409).json({ error: 'เบอร์นี้ถูกลงทะเบียนแล้ว' });
    }

    const rawPassword = phone.slice(-4); // ใช้ 4 ตัวท้ายของเบอร์เป็น password เริ่มต้น
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
      },
    });

    return res.status(201).json(newCustomer);
  } catch (err) {
    console.error('[createCustomer] ❌', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างลูกค้า' });
  }
};

// ✅ อัปเดตข้อมูลลูกค้า (CustomerProfile + User.email)
const updateCustomerProfile = async (req, res) => {
  console.log('updateCustomerProfile : ', req.body);

  const userId = req.user.id;
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
      data: {
        name,
        phone,
        address,
        district,
        province,
        postalCode,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('🔥 updateCustomerProfile error:', error);
    res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลลูกค้าได้' });
  }
};

module.exports = {
  getCustomerByPhone,
  getCustomerByUserId,
  createCustomer,
  updateCustomerProfile,
};
