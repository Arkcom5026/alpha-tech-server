// 📁 FILE: controllers/customerController.js
// ✅ COMMENT: logic สำหรับสร้างลูกค้าแบบด่วนผ่านเบอร์โทร

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.quickCreateCustomer = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'กรุณาระบุเบอร์โทร' });

    const last4 = phone.slice(-4);
    const email = `auto+${phone}@quick.pos`;

    const customerUser = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: last4,
        role: 'customer',
        customerProfile: {
          create: {
            phone,
            name: 'ลูกค้าใหม่',
          },
        },
      },
      include: { customerProfile: true },
    });

    res.json({
      userId: customerUser.id,
      customerId: customerUser.customerProfile?.id,
      phone: customerUser.customerProfile?.phone,
      name: customerUser.customerProfile?.name,
    });
  } catch (err) {
    console.error('❌ [quick-create-customer]', err);
    res.status(500).json({ error: 'ไม่สามารถสร้างลูกค้าอัตโนมัติได้' });
  }
};
