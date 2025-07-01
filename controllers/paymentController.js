// controllers/paymentController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const generatePaymentCode = async (branchId) => {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2); // "25"
  const month = String(now.getMonth() + 1).padStart(2, '0'); // "06"
  const prefix = `PMT-${branchId}${year}${month}`; // เช่น "PMT-022506"

  const existing = await prisma.payment.findMany({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    select: {
      code: true,
    },
    orderBy: {
      code: 'desc',
    },
    take: 1,
  });

  let nextNumber = 1;
  if (existing.length > 0) {
    const lastCode = existing[0].code;
    const lastNumber = parseInt(lastCode.split('-').pop());
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}-${String(nextNumber).padStart(3, '0')}`; // เช่น "PMT-022506-001"
};

const createPayments = async (req, res) => {
  try {
    const body = req.body;
    const branchId = req.user?.branchId;
    const employeeId = req.user?.employeeId;

    console.log('createPayments req.body : ', body);

    const { saleId, note, combinedDocumentCode, paymentItems } = body;

    if (!saleId || !Array.isArray(paymentItems) || paymentItems.length === 0) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน saleId หรือรายการชำระเงินหายไป' });
    }

    const code = await generatePaymentCode(branchId);
    console.log('📌 generatePaymentCode:', code);

    // ✅ ตรวจสอบและจัดการ DEPOSIT ก่อนสร้าง payment
    for (const item of paymentItems) {
      if (item.paymentMethod === 'DEPOSIT') {
        const { customerDepositId, amount } = item;
        if (!customerDepositId) {
          return res.status(400).json({ message: 'ต้องระบุ customerDepositId สำหรับการชำระแบบ DEPOSIT' });
        }

        const deposit = await prisma.customerDeposit.findUnique({
          where: { id: customerDepositId },
          include: { depositUsage: true },
        });

        if (!deposit || deposit.status !== 'ACTIVE') {
          return res.status(404).json({ message: 'ไม่พบยอดเงินมัดจำที่ใช้งานได้' });
        }

        const usedAmount = deposit.depositUsage.reduce((sum, u) => sum + u.amountUsed, 0);
        const available = deposit.totalAmount - usedAmount;

        if (parseFloat(amount) > available) {
          return res.status(400).json({ message: 'ยอดเงินมัดจำไม่เพียงพอ' });
        }

        // ✅ สร้าง DepositUsage
        await prisma.depositUsage.create({
          data: {
            customerDepositId,
            saleId,
            amountUsed: parseFloat(amount),
          },
        });

        console.log(`✅ ใช้มัดจำ ${amount} บาท จาก customerDepositId=${customerDepositId}`);
      }
    }

    const created = await prisma.payment.create({
      data: {
        code,
        receivedAt: new Date(),
        note: note || null,
        combinedDocumentCode: combinedDocumentCode || null,

        sale: { connect: { id: Number(saleId) } },
        employeeProfile: employeeId ? { connect: { id: employeeId } } : undefined,
        branch: branchId ? { connect: { id: branchId } } : undefined,

        items: {
          create: paymentItems.map((item) => ({
            paymentMethod: item.paymentMethod,
            amount: parseFloat(item.amount || 0),
            note: item.note || null,
            slipImage: item.slipImage || null,
            cardRef: item.cardRef || null,
            govImage: item.govImage || null,
          })),
        },
      },
    });

    // ✅ ตรวจสอบยอดรวมและอัปเดตสถานะ paid ใน Sale ถ้าชำระครบ
    const totalPaid = paymentItems.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const sale = await prisma.sale.findUnique({ where: { id: Number(saleId) } });

    if (sale && totalPaid >= sale.totalAmount) {
      await prisma.sale.update({
        where: { id: Number(saleId) },
        data: { paid: true, paidAt: new Date() },
      });
    }

    return res.status(201).json({ message: 'บันทึกข้อมูลการชำระเงินแล้ว', paymentId: created.id });
  } catch (error) {
    console.error('❌ [createPayments] error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
  }
};


const searchPrintablePayments = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { keyword } = req.query;

    const payments = await prisma.payment.findMany({
      where: {
        branchId,
        ...(keyword && {
          OR: [
            {
              sale: {
                customer: {
                  name: {
                    contains: keyword,
                    mode: 'insensitive',
                  },
                },
              },
            },
            {
              sale: {
                customer: {
                  phone: {
                    contains: keyword,
                    mode: 'insensitive',
                  },
                },
              },
            },
            {
              sale: {
                code: {
                  contains: keyword,
                  mode: 'insensitive',
                },
              },
            },
          ],
        }),
      },
      orderBy: { receivedAt: 'desc' },
      include: {
        sale: {
          include: {
            branch: true,
            customer: true,
            items: {
              include: {
                stockItem: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
        employeeProfile: true,
      },
    });

    console.log('searchPrintablePayments :', payments);

    res.json(payments);
  } catch (error) {
    console.error('❌ [searchPrintablePayments] error:', error);
    res.status(500).json({ message: 'ไม่สามารถโหลดข้อมูลใบเสร็จได้' });
  }
};


const cancelPayment = async (req, res) => {
  try {
    const { paymentId, note } = req.body;
    const branchId = req.user.branchId;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.branchId !== branchId) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลการชำระเงินในสาขานี้' });
    }

    if (payment.isCancelled) {
      return res.status(400).json({ message: 'รายการนี้ถูกยกเลิกแล้ว' });
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        isCancelled: true,
        cancelNote: note || null,
        cancelledAt: new Date(),
      },
    });

    res.json({ message: 'ยกเลิกรายการชำระเงินเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ [cancelPayment] error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการยกเลิก' });
  }
};

module.exports = {
  createPayments,
  searchPrintablePayments,
  cancelPayment,
};
