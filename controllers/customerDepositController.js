// controllers/customerDepositController.js

const prisma = require('../lib/prisma');

const createCustomerDeposit = async (req, res) => {
  try {
    const { cashAmount = 0, transferAmount = 0, cardAmount = 0, note, customerId } = req.body;
    const totalAmount = parseFloat(cashAmount) + parseFloat(transferAmount) + parseFloat(cardAmount);
    console.log('createCustomerDeposit : ', req.body);

    if (!customerId || totalAmount <= 0) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบหรือยอดรวมต้องมากกว่า 0' });
    }

    const employeeId = req.user.id;
    const branchId = req.user.branchId;

    const deposit = await prisma.customerDeposit.create({
      data: {
        cashAmount,
        transferAmount,
        cardAmount,
        totalAmount,
        note,
        customerId,
        createdBy: employeeId.toString(),
        branchId,
        status: 'ACTIVE',
      },
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    res.status(201).json(deposit);
  } catch (err) {
    console.error('❌ createCustomerDeposit error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกเงินมัดจำ' });
  }
};

const getAllCustomerDeposits = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const deposits = await prisma.customerDeposit.findMany({
      where: {
        branchId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });
    res.json(deposits);
  } catch (err) {
    console.error('❌ getAllCustomerDeposits error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
};

const getCustomerDepositById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID ไม่ถูกต้อง' });
    }

    const branchId = req.user.branchId;

    const deposit = await prisma.customerDeposit.findFirst({
      where: {
        id,
        branchId,
        status: 'ACTIVE',
      },
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!deposit) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลมัดจำ' });
    }

    res.json(deposit);
  } catch (error) {
    console.error('getCustomerDepositById error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลมัดจำ' });
  }
};

const getCustomerAndDepositByPhone = async (req, res) => {
  try {
    const rawPhone = req.params.phone;
    const phone = rawPhone?.replace(/\D/g, '').trim(); // Normalize เบอร์โทร
    const branchId = req.user.branchId;

    if (!phone) {
      return res.status(400).json({ message: 'กรุณาระบุเบอร์โทร' });
    }

    const customer = await prisma.customerProfile.findFirst({
      where: { phone },
      include: {
        user: true,
        customerDeposit: {
          where: {
            branchId,
            status: 'ACTIVE',
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ message: 'ไม่พบลูกค้า' });
    }

    if (customer.customerDeposit.length === 0) {
      console.warn(`[ไม่มีมัดจำ] ลูกค้า ${customer.name} (${phone}) มีโปรไฟล์แต่ยังไม่มีมัดจำในสาขา ${branchId}`);
    }

    const totalDeposit = customer.customerDeposit.reduce(
      (sum, item) =>
        sum + item.cashAmount + item.transferAmount + item.cardAmount,
      0
    );

    return res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.user?.email || '',
        type: customer.type,
        companyName: customer.companyName,
        address: customer.address,
        taxId: customer.taxId,
        creditLimit: customer.creditLimit,
        creditBalance: customer.creditBalance,
      },
      totalDeposit,
      deposits: customer.customerDeposit,
    });
  } catch (err) {
    console.error('[getCustomerAndDepositByPhone] ❌', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้าและมัดจำ' });
  }
};


const getCustomerAndDepositByName = async (req, res) => {
  try {
    console.log('========== Controller Triggered =========');
    console.log('getCustomerAndDepositByName req.query', req.query);
    let { q } = req.query;
    const branchId = req.user.branchId;

    if (!q || typeof q !== 'string' || q.trim() === '') {
      console.log('[getCustomerAndDepositByName] ❌ Invalid query param `q`');
      return res.status(400).json({ error: 'กรุณาระบุคำค้นหาที่ถูกต้อง' });
    }
    q = q.trim();
    console.log('[getCustomerAndDepositByName] q =', q);
    console.log('[getCustomerAndDepositByName] branchId =', branchId);

    const customers = await prisma.customerProfile.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { companyName: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      include: {
        user: true,
        customerDeposit: {
          where: {
            branchId,
            status: 'ACTIVE',
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    console.log('[getCustomerAndDepositByName] Raw customers found:', customers.length);

    const result = customers.map((c) => {
      const totalDeposit = c.customerDeposit?.reduce(
        (sum, d) =>
          sum + d.cashAmount + d.transferAmount + d.cardAmount,
        0
      ) || 0;

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.user?.email || '',
        type: c.type || '',
        companyName: c.companyName || '',
        taxId: c.taxId || '',
        address: c.address || '',
        totalDeposit,
        deposits: c.customerDeposit,
      };
    });

    console.log(`[getCustomerAndDepositByName] ✅ พบลูกค้า ${result.length} คน`);

   
    if (result.length > 0) {
      const first = result[0];
      return res.json({
        customer: {
          id: first.id,
          name: first.name,
          phone: first.phone,
          email: first.email,
          type: first.type,
          companyName: first.companyName || '',
          taxId: first.taxId || '',
          address: first.address || '',
        },
        totalDeposit: first.totalDeposit,
        deposits: first.deposits,
      });
    } else {
      return res.status(404).json({ error: 'ไม่พบลูกค้า' });
    }
  } catch (err) {
    console.error('[getCustomerAndDepositByName] ❌', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาชื่อลูกค้าและเงินมัดจำ' });
  }
};


const updateCustomerDeposit = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const branchId = req.user.branchId;

    const existing = await prisma.customerDeposit.findFirst({
      where: {
        id,
        branchId,
        status: 'ACTIVE',
      },
    });
    if (!existing) {
      return res.status(404).json({ message: 'ไม่พบรายการที่ต้องการแก้ไข' });
    }

    // เช็คว่าเป็น Soft Delete หรือไม่ (cancel)
    if (req.body.status === 'CANCELLED') {
      const cancelled = await prisma.customerDeposit.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      return res.json(cancelled);
    }

    const {
      cashAmount = 0,
      transferAmount = 0,
      cardAmount = 0,
      note,
    } = req.body;
    const totalAmount = parseFloat(cashAmount) + parseFloat(transferAmount) + parseFloat(cardAmount);

    const updated = await prisma.customerDeposit.update({
      where: { id },
      data: {
        cashAmount,
        transferAmount,
        cardAmount,
        totalAmount,
        note,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('❌ updateCustomerDeposit error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' });
  }
};

const deleteCustomerDeposit = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const branchId = req.user.branchId;

    const existing = await prisma.customerDeposit.findFirst({
      where: {
        id,
        branchId,
        status: 'ACTIVE',
      },
    });
    if (!existing) {
      return res.status(404).json({ message: 'ไม่พบรายการที่ต้องการลบ' });
    }

    await prisma.customerDeposit.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'ยกเลิกรายการเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('❌ deleteCustomerDeposit error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
};

const useCustomerDeposit = async (req, res) => {
  try {
    const { depositId, amountUsed, saleId } = req.body;
    const branchId = req.user.branchId;

    if (!depositId || !amountUsed || !saleId) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const deposit = await prisma.customerDeposit.findFirst({
      where: {
        id: depositId,
        branchId,
        status: 'ACTIVE',
      },
    });

    if (!deposit) {
      return res.status(404).json({ message: 'ไม่พบรายการมัดจำ' });
    }

    if (deposit.totalAmount < amountUsed) {
      return res.status(400).json({ message: 'ยอดมัดจำไม่พอสำหรับการใช้งาน' });
    }

    await prisma.customerDeposit.update({
      where: { id: depositId },
      data: {
        status: 'USED',
        usedAmount: amountUsed,
        usedSaleId: saleId,
      },
    });

    return res.json({ message: 'ใช้มัดจำสำเร็จ' });
  } catch (err) {
    console.error('❌ useCustomerDeposit error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการใช้เงินมัดจำ' });
  }
};

module.exports = {
  createCustomerDeposit,
  getAllCustomerDeposits,
  getCustomerDepositById,
  updateCustomerDeposit,
  deleteCustomerDeposit,
  getCustomerAndDepositByPhone,
  useCustomerDeposit,
  getCustomerAndDepositByName,
};
