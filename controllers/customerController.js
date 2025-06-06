const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

    return res.json(customer);
  } catch (err) {
    console.error('[getCustomerByPhone] ❌', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้า' });
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

    const password = phone.slice(-4); // ใช้ 4 ตัวท้ายของเบอร์เป็น password เริ่มต้น

    const newUser = await prisma.user.create({
      data: {
        email: email || null,
        loginId: phone,
        password,
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

module.exports = {
  getCustomerByPhone,
  createCustomer,
};
