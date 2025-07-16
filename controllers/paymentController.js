// controllers/paymentController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const generatePaymentCode = async (branchId) => {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2); // "25"
  const month = String(now.getMonth() + 1).padStart(2, '0'); // "06"
  const branchCode = String(branchId).padStart(2, '0');
  const prefix = `PMT-${branchCode}${year}${month}`; // เช่น "PMT-022506"

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

  return `${prefix}${String(nextNumber).padStart(3, '0')}`; // เช่น "PMT-022506-001"
};

const createPayments = async (req, res) => {
  try {
    const body = req.body;
    const branchId = req.user?.branchId;
    const employeeId = req.user?.employeeId;

    const { saleId, note, combinedDocumentCode, paymentItems } = body;

    if (!saleId || !Array.isArray(paymentItems) || paymentItems.length === 0) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน saleId หรือรายการชำระเงินหายไป' });
    }

    const code = await generatePaymentCode(branchId);


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
    const { keyword, fromDate, toDate } = req.query; // รับ fromDate และ toDate มาจาก query

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
        // เพิ่มเงื่อนไขการกรองตามช่วงวันที่ receivedAt
        ...(fromDate && { receivedAt: { gte: new Date(fromDate) } }),
        ...(toDate && { receivedAt: { lte: new Date(toDate) } }),
      },
      orderBy: { receivedAt: 'desc' },
      include: {
        // Include payment items for details on payment methods and amounts
        items: true,
        sale: {
          include: {
            branch: true, // Branch info for config
            customer: true, // Customer info
            items: { // Sale items
              include: {
                // SaleItem.price จะถูกดึงมาโดยอัตโนมัติหากเป็น scalar field
                stockItem: { // Stock item for product details
                  include: {
                    product: { // Product for name and unit
                      include: {
                        // Assuming 'template' and 'unit' relations exist for product unit
                        template: {
                          include: {
                            unit: true, // Unit name
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            // Note: Sale.paymentTerms and Sale.dueDate are used in BillLayoutFullTax but are not
            // present in the Sale model in the provided schema. If required, add them to the Sale model.
          },
        },
        employeeProfile: true, // Employee who processed the payment
      },
    });

    // สำคัญ: เปลี่ยน console.log ให้แสดงผลแบบเต็มรูปแบบเพื่อการดีบัก
    console.log('searchPrintablePayments :', JSON.stringify(payments, null, 2));

    // Note: The BillLayoutFullTax component expects 'sale', 'saleItems', 'payments', and 'config'
    // as separate props. The frontend will need to transform this 'payments' array
    // into the required structure for BillLayoutFullTax.

    // Missing fields in current schema/query for BillLayoutFullTax (consider adding to Prisma Schema if needed):
    // 1. SaleItem.quantity: The current schema for SaleItem does not explicitly have a 'quantity' field.
    //    If a SaleItem represents multiple units of a product, a 'quantity' field needs to be added to the SaleItem model.
    //    Currently, BillLayoutFullTax assumes 'item.quantity'. If each SaleItem is 1 unit, this is implicitly 1.
    // 2. config.vatRate: BillLayoutFullTax uses this for VAT calculation. It's assumed to be part of the 'config' prop.
    //    This value should ideally come from the 'branch' data (e.g., branch.vatRate) or a system-wide setting.
    //    Ensure 'branch' model has 'vatRate' or pass it separately.

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

