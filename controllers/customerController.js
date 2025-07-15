// customerController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const bcrypt = require('bcryptjs');

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

    // ✨ ปรับปรุง: ส่งข้อมูลลูกค้ากลับไปให้ครบถ้วน
    return res.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      email: customer.user?.email || '',
      // เพิ่มฟิลด์ใหม่ที่จำเป็นสำหรับหน้าขาย
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

    if (!q) {
      return res.status(400).json({ error: 'กรุณาระบุคำค้นหา' });
    }

    const customers = await prisma.customerProfile.findMany({
      where: {
        name: {
          contains: q,
          mode: 'insensitive',
        },
      },
      take: 10,
      include: { user: true },
    });

    // ✨ แก้ไข: map ข้อมูลลูกค้าให้ครบถ้วนก่อนส่งกลับ
    return res.json(
      customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        email: c.user?.email || '',
        // เพิ่มฟิลด์ที่จำเป็นสำหรับหน้าขาย
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


const createCustomer = async (req, res) => {
  try {
    // ✨ รับข้อมูลใหม่ๆ จาก req.body
    const { name, phone, email, address, type, companyName, taxId } = req.body;

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

    // ✨ เพิ่ม field ใหม่ๆ ตอนสร้าง CustomerProfile
    const newCustomer = await prisma.customerProfile.create({
      data: {
        name,
        phone,
        address: address || null,
        userId: newUser.id,
        type: type || 'INDIVIDUAL', // 'INDIVIDUAL', 'ORGANIZATION', 'GOVERNMENT'
        companyName: companyName || null,
        taxId: taxId || null,
        // สามารถกำหนดค่าเริ่มต้นสำหรับ creditLimit ที่นี่ได้ถ้าต้องการ
        // creditLimit: 0, 
      },
    });

    return res.status(201).json(newCustomer);
  } catch (err) {
    console.error('[createCustomer] ❌', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างลูกค้า' });
  }
};


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
  getCustomerByName,
  getCustomerByUserId,
  createCustomer,
  updateCustomerProfile,
};
