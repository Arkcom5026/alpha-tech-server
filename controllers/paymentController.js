// controllers/paymentController.js
const { prisma, Prisma } = require('../lib/prisma');

// Helpers & flags for Decimal-safe arithmetic
const D = (v) => new Prisma.Decimal(typeof v === 'string' ? v : Number(v));
const toNum = (v) => (v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v));
const isMoneyLike = (v) => (typeof v === 'number' && !isNaN(v)) || (typeof v === 'string' && /^\d+(\.\d{1,2})?$/.test(v));
const NORMALIZE_DECIMAL_TO_NUMBER = process.env.NORMALIZE_DECIMAL_TO_NUMBER !== '0';

// ✅ สร้างรหัสการชำระเงินใหม่ (ป้องกันชนกันด้วย attempt)
const generatePaymentCode = async (branchId, attempt = 0) => {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const branchCode = String(branchId).padStart(2, '0');
  const prefix = `PMT-${branchCode}${year}${month}`; // e.g., PMT-022506

  const last = await prisma.payment.findFirst({
    where: { code: { startsWith: `${prefix}-` } },
    select: { code: true },
    orderBy: { code: 'desc' },
  });

  const next = last ? (parseInt(last.code.split('-').pop(), 10) + 1 + attempt) : (1 + attempt);
  return `${prefix}-${String(next).padStart(3, '0')}`; // e.g., PMT-022506-001
};

// 1) createPayments → บันทึกการชำระเงินใหม่
const createPayments = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const employeeId = Number(req.user?.employeeId);
    const { saleId, note, combinedDocumentCode, paymentItems } = req.body;

    if (!saleId || !Array.isArray(paymentItems) || paymentItems.length === 0) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน saleId หรือรายการชำระเงินหายไป' });
    }
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    for (const it of paymentItems) {
      if (!isMoneyLike(it.amount) || Number(it.amount) <= 0) {
        return res.status(400).json({ message: 'จำนวนเงินไม่ถูกต้อง' });
      }
    }

    // Ensure sale belongs to current branch
    const sale = await prisma.sale.findUnique({ where: { id: Number(saleId) }, select: { branchId: true } });
    if (!sale || Number(sale.branchId) !== branchId) {
      return res.status(404).json({ message: 'ไม่พบใบขายในสาขานี้' });
    }

    let createdPayment;

    await prisma.$transaction(async (tx) => {
      // Pre-validate DEPOSIT availability
      for (const item of paymentItems) {
        if (item.paymentMethod === 'DEPOSIT') {
          const depId = Number(item.customerDepositId);
          if (!depId) throw Object.assign(new Error('ต้องระบุ customerDepositId สำหรับการชำระแบบ DEPOSIT'), { status: 400 });
          const dep = await tx.customerDeposit.findUnique({ where: { id: depId }, include: { depositUsage: true } });
          if (!dep || dep.status !== 'ACTIVE' || Number(dep.branchId) !== branchId) {
            throw Object.assign(new Error('ไม่พบยอดเงินมัดจำที่ใช้งานได้'), { status: 404 });
          }
          const used = (dep.usedAmount ?? (dep.depositUsage?.reduce((s,u)=> s.plus(u.amountUsed), new Prisma.Decimal(0)) || new Prisma.Decimal(0)));
          const available = dep.totalAmount.minus(used);
          const need = D(item.amount);
          if (available.lessThan(need)) {
            throw Object.assign(new Error('ยอดเงินมัดจำไม่เพียงพอ'), { status: 400 });
          }
        }
      }

      // Create payment with retry on code collision
      let payment;
      for (let attempt = 0; attempt <= 3; attempt++) {
        const code = await generatePaymentCode(branchId, attempt);
        try {
          payment = await tx.payment.create({
            data: {
              code,
              receivedAt: new Date(),
              note: note || null,
              combinedDocumentCode: combinedDocumentCode || null,
              saleId: Number(saleId),
              employeeProfileId: employeeId || null,
              branchId,
              items: {
                create: paymentItems.map((it) => ({
                  paymentMethod: it.paymentMethod,
                  amount: D(it.amount || 0),
                  note: it.note || null,
                  slipImage: it.slipImage || null,
                  cardRef: it.cardRef || null,
                  govImage: it.govImage || null,
                })),
              },
            },
            include: { items: true },
          });
          break;
        } catch (e) {
          if (e?.code === 'P2002' && /code/.test(String(e?.meta?.target)) && attempt < 3) continue;
          throw e;
        }
      }

      // Log deposit usage and update deposit status when DEPOSIT is used
      for (const src of paymentItems) {
        if (src.paymentMethod === 'DEPOSIT') {
          const depId = Number(src.customerDepositId);
          const amt = D(src.amount || 0);
          await tx.depositUsage.create({ data: { customerDepositId: depId, saleId: Number(saleId), amountUsed: amt } });
          const dep = await tx.customerDeposit.update({ where: { id: depId }, data: { usedAmount: { increment: amt } } });
          if (dep.usedAmount.greaterThanOrEqualTo ? dep.usedAmount.greaterThanOrEqualTo(dep.totalAmount) : toNum(dep.usedAmount) >= toNum(dep.totalAmount)) {
            await tx.customerDeposit.update({ where: { id: depId }, data: { status: 'USED' } });
          }
        }
      }

      // Recompute paid status after creation
      const agg = await tx.paymentItem.aggregate({ _sum: { amount: true }, where: { payment: { saleId: Number(saleId), isCancelled: false } } });
      const sumPaid = agg._sum.amount || new Prisma.Decimal(0);
      const saleRow = await tx.sale.findUnique({ where: { id: Number(saleId) }, select: { totalAmount: true } });
      if (sumPaid.greaterThanOrEqualTo ? sumPaid.greaterThanOrEqualTo(saleRow.totalAmount) : toNum(sumPaid) >= toNum(saleRow.totalAmount)) {
        await tx.sale.update({ where: { id: Number(saleId) }, data: { paid: true, paidAt: new Date() } });
      }

      createdPayment = payment;
    });

    return res.status(201).json({ message: 'บันทึกข้อมูลการชำระเงินแล้ว', paymentId: createdPayment.id });
  } catch (error) {
    console.error('❌ [createPayments] error:', error);
    const status = error?.status || 500;
    return res.status(status).json({ message: error?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
  }
};

// 2) searchPrintablePayments → ค้นหาใบเสร็จสำหรับพิมพ์
const searchPrintablePayments = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const { keyword, fromDate, toDate } = req.query;

    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const where = {
      branchId,
      ...(keyword ? {
        OR: [
          { sale: { customer: { name: { contains: String(keyword), mode: 'insensitive' } } } },
          { sale: { customer: { phone: { contains: String(keyword), mode: 'insensitive' } } } },
          { sale: { code: { contains: String(keyword), mode: 'insensitive' } } },
          { sale: { customer: { companyName: { contains: String(keyword), mode: 'insensitive' } } } },
        ],
      } : {}),
      ...(fromDate || toDate ? {
        receivedAt: {
          ...(fromDate ? { gte: new Date(fromDate) } : {}),
          ...(toDate ? { lte: new Date(new Date(toDate).setHours(23,59,59,999)) } : {}),
        },
      } : {}),
    };

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      include: {
        items: true,
        sale: {
          include: {
            branch: true,
            customer: true,
            items: { include: { stockItem: { include: { product: { select: { name: true, model: true, template: true } } } } } },
          },
        },
        employeeProfile: true,
      },
    });

    const result = payments.map((p) => {
      const total = p.items.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
      return { ...p, amount: NORMALIZE_DECIMAL_TO_NUMBER ? toNum(total) : total };
    });

    res.json(result);
  } catch (error) {
    console.error('❌ [searchPrintablePayments] error:', error);
    res.status(500).json({ message: 'ไม่สามารถโหลดข้อมูลใบเสร็จได้' });
  }
};

// 3) cancelPayment → ยกเลิกรายการชำระ
const cancelPayment = async (req, res) => {
  try {
    const { paymentId, note } = req.body;
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const payment = await prisma.payment.findUnique({ where: { id: Number(paymentId) }, include: { items: true } });

    if (!payment || Number(payment.branchId) !== branchId) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลการชำระเงินในสาขานี้' });
    }
    if (payment.isCancelled) {
      return res.status(400).json({ message: 'รายการนี้ถูกยกเลิกแล้ว' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { isCancelled: true, cancelNote: note || null, cancelledAt: new Date() } });

      // Recompute sale paid status after cancellation
      const agg = await tx.paymentItem.aggregate({ _sum: { amount: true }, where: { payment: { saleId: payment.saleId, isCancelled: false } } });
      const paid = agg._sum.amount || new Prisma.Decimal(0);
      const saleRow = await tx.sale.findUnique({ where: { id: payment.saleId }, select: { totalAmount: true } });
      const isPaid = paid.greaterThanOrEqualTo ? paid.greaterThanOrEqualTo(saleRow.totalAmount) : toNum(paid) >= toNum(saleRow.totalAmount);
      if (!isPaid) {
        await tx.sale.update({ where: { id: payment.saleId }, data: { paid: false, paidAt: null } });
      }
      // NOTE: ไม่ได้ย้อนยอดมัดจำกลับ เพราะ schema ไม่ได้ผูกรายการมัดจำกับ payment item เฉพาะเจาะจง
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
