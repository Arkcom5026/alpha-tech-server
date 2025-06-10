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

// ✅ สร้างลูกค้าใหม่ พร้อมสร้าง User + CustomerProfile
const bcrypt = require('bcryptjs');

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
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, address } = req.body;

    const existing = await prisma.customerProfile.findUnique({
      where: { id: Number(id) },
      include: { user: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'ไม่พบลูกค้า' });
    }

    // อัปเดต CustomerProfile
    const updatedCustomer = await prisma.customerProfile.update({
      where: { id: Number(id) },
      data: {
        name,
        address,
      },
    });

    // อัปเดต email ใน User (ถ้ามีการส่ง email มา)
    if (email !== undefined) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: { email },
      });
    }

    return res.json(updatedCustomer);
  } catch (err) {
    console.error('[updateCustomer] ❌', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตลูกค้า' });
  }
};


module.exports = {
  getCustomerByPhone,
  createCustomer,
  updateCustomer,
};





