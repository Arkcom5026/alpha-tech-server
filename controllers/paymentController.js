// controllers/paymentController.js
const { prisma, Prisma } = require('../lib/prisma');

// Helpers & flags for Decimal-safe arithmetic
const D = (v) => new Prisma.Decimal(typeof v === 'string' ? v : Number(v));
const toNum = (v) => (v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v));
const isMoneyLike = (v) => (typeof v === 'number' && !isNaN(v)) || (typeof v === 'string' && /^\d+(\.\d{1,2})?$/.test(v));

// === Fast, collision-safe payment code generator (counter-based, monthly reset, legacy format) ===
// Legacy format: PMT-<bb><yy><mm><rrr>
//   - yy : Gregorian year (AD) last 2 digits
//   - mm : month 2 digits
//   - rrr: running 3 digits, reset monthly per branch
const bangkokNow = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000; // to UTC
  return new Date(utc + 7 * 60 * 60000); // Asia/Bangkok (+07:00)
};

const buildLegacyPaymentCode = ({ branchId, counter }) => {
  const d = bangkokNow();
  const yy = String(d.getFullYear()).slice(-2);     // Gregorian year (2 digits)
  const mm = String(d.getMonth() + 1).padStart(2, '0');   // month 2 digits
  const bb = String(branchId).padStart(2, '0');           // branch 2 digits
  const rrr = String(counter).padStart(3, '0');           // running 3 digits
  return `PMT-${bb}${yy}${mm}${rrr}`;                     // e.g. PMT-022509001
};

// Use PaymentCodeCounter with key (branchId, period=yyMM in BE) for monthly reset per branch
const nextPaymentCode = async (tx, branchId) => {
  const d = bangkokNow();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const period = `${yy}${mm}`; // yyMM (AD)
  const bb = String(branchId).padStart(2, '0');
  const prefix = `PMT-${bb}${yy}${mm}`;

  // Strategy:
  // 1) Try atomic increment on existing counter.
  // 2) If counter not found, seed it from current max(payment.code) with same prefix, then retry.
  // This avoids duplicate 'code' when system already has historical payments for this month.
  let counter = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const upd = await tx.paymentCodeCounter.update({
        where: { branchId_yyyymmdd: { branchId, yyyymmdd: period } },
        data: { lastNo: { increment: 1 } },
        select: { lastNo: true },
      });
      counter = upd.lastNo;
      break;
    } catch (e) {
      // P2025 = record to update not found → seed
      if (e?.code === 'P2025') {
        const last = await tx.payment.findFirst({
          where: { branchId, code: { startsWith: prefix } },
          orderBy: { code: 'desc' },
          select: { code: true },
        });
        const maxNo = last ? parseInt(String(last.code).slice(prefix.length), 10) || 0 : 0;
        try {
          await tx.paymentCodeCounter.create({
            data: { branchId, yyyymmdd: period, lastNo: maxNo },
            select: { branchId: true },
          });
        } catch (ce) {
          // Another transaction created it meanwhile → ignore and retry update
          if (ce?.code !== 'P2002') throw ce;
        }
        continue; // retry update after seeding
      } else {
        throw e;
      }
    }
  }
  if (counter == null) throw new Error('GEN_CODE_FAILED');
  return buildLegacyPaymentCode({ branchId, counter });
};

// 1) createPayments → บันทึกการชำระเงินใหม่
const createPayments = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const employeeId = Number(req.user?.employeeId || req.user?.employeeProfileId);
    const { saleId, note, combinedDocumentCode, paymentItems, receivedAt } = req.body || {};

    if (!saleId || !Array.isArray(paymentItems) || paymentItems.length === 0) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน saleId หรือรายการชำระเงินหายไป' });
    }
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    for (const it of paymentItems) {
      if (!isMoneyLike(it.amount) || Number(it.amount) <= 0) {
        return res.status(400).json({ message: 'จำนวนเงินไม่ถูกต้อง' });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1) Ensure sale belongs to current branch & not cancelled
      const sale = await tx.sale.findFirst({
        where: { id: Number(saleId), branchId, status: { not: 'CANCELLED' } },
        select: { id: true, totalAmount: true },
      });
      if (!sale) throw Object.assign(new Error('ไม่พบใบขายในสาขานี้'), { status: 404 });

      // 2) Parse receivedAt (default now, respect +07:00 ISO if provided)
      const receivedAtDate = receivedAt ? new Date(receivedAt) : new Date();

      // 3) Generate code & create payment header + items (Counter-based, with duplicate retry)
      const code = await nextPaymentCode(tx, branchId);
      const payment = await tx.payment.create({
        data: {
          code,
          receivedAt: receivedAtDate,
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

      // 5) Consume deposit atomically (from request items, schema has no FK on paymentItem)
      for (const p of paymentItems) {
        if (p.paymentMethod === 'DEPOSIT' && p.customerDepositId) {
          const depId = Number(p.customerDepositId);
          const inc = Number(p.amount) || 0;

          const dep = await tx.customerDeposit.findUnique({ where: { id: depId }, select: { id: true, branchId: true } });
          if (!dep || Number(dep.branchId) !== branchId) {
            throw Object.assign(new Error('ไม่พบยอดมัดจำในสาขานี้'), { status: 404 });
          }

          await tx.customerDeposit.update({
            where: { id: depId },
            data: { usedAmount: { increment: inc } },
          });

          // record usage row (if table exists)
          if (tx.depositUsage && typeof tx.depositUsage.create === 'function') {
            await tx.depositUsage.create({
              data: { customerDepositId: depId, saleId: Number(saleId), amountUsed: D(inc), paymentId: payment.id },
            });
          }

          // auto-close deposit if fully used (best-effort)
          const depAfter = await tx.customerDeposit.findUnique({ where: { id: depId }, select: { usedAmount: true, totalAmount: true } });
          const used = Number(depAfter?.usedAmount || 0);
          const total = Number(depAfter?.totalAmount || 0);
          if (used >= total && total > 0) {
            await tx.customerDeposit.update({ where: { id: depId }, data: { status: 'USED' } });
          }
        }
      }

      // 6) Recompute paid flag
      const agg = await tx.paymentItem.aggregate({ _sum: { amount: true }, where: { payment: { saleId: Number(saleId), isCancelled: false } } });
      const sumPaid = agg._sum.amount || new Prisma.Decimal(0);
      const paidEnough = (sumPaid.greaterThanOrEqualTo?.(sale.totalAmount)) || (toNum(sumPaid) >= toNum(sale.totalAmount));
      await tx.sale.update({ where: { id: sale.id }, data: { paid: paidEnough, paidAt: paidEnough ? new Date() : null } });

      return { paymentId: payment.id, code };
    }, { timeout: 20000, maxWait: 20000 });

    return res.status(201).json({ message: 'บันทึกข้อมูลการชำระเงินแล้ว', paymentId: result.paymentId, code: result.code });
  } catch (error) {
    console.error('❌ [createPayments] error:', error);
    const status = error?.status || 500;
    return res.status(status).json({ message: error?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
  }
};

// 2) searchPrintablePayments → ค้นหาใบเสร็จสำหรับพิมพ์
const toLocalRange = (dateStr, tz = '+07:00') => {
  if (!dateStr) return {};
  const start = new Date(`${dateStr}T00:00:00.000${tz}`);
  const end = new Date(`${dateStr}T23:59:59.999${tz}`);
  return { start, end };
};

const searchPrintablePayments = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const { keyword = '', fromDate, toDate, limit: limitRaw } = req.query;
    const limit = Math.min(parseInt(limitRaw, 10) || 100, 500);

    const fromRange = fromDate ? toLocalRange(fromDate) : null;
    const toRange = toDate ? toLocalRange(toDate) : null;

    const where = {
      // ❌ ห้ามส่ง branchId จาก FE — ใช้ branchId จาก req.user เท่านั้น
      branchId,
      isCancelled: false,    // ✅ ตัดการชำระที่ถูกยกเลิก
      sale: {
        is: {
          status: { not: 'CANCELLED' },
          branchId, // ✅ ยืนยันว่า Sale อยู่สาขาเดียวกัน
          ...(keyword ? {
            OR: [
              { code:        { contains: keyword, mode: 'insensitive' } },
              { customer: {  name:        { contains: keyword, mode: 'insensitive' } } },
              { customer: {  companyName: { contains: keyword, mode: 'insensitive' } } },
            ],
          } : {}),
        },
      },
      ...(fromRange || toRange ? {
        receivedAt: {
          ...(fromRange ? { gte: fromRange.start } : {}),
          ...(toRange ? { lte: toRange.end } : {}),
        },
      } : {}),
    };

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: limit,
      include: {
        items: true,
        sale: {
          include: {
            branch: true,
            customer: true,
            items: {
              include: {
                stockItem: {
                  include: { product: { select: { name: true, template: true } } },

                },
              },
            },
          },
        },
        employeeProfile: true,
      },
    });

    const result = payments.map((p) => {
      const total = p.items.reduce(
        (sum, item) => sum.add(item.amount || 0),
        new Prisma.Decimal(0)
      );
      return { ...p, amount: Number(total.toFixed(2)) };
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
    const { paymentId, note } = req.body || {};
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const payment = await prisma.payment.findUnique({
      where: { id: Number(paymentId) },
      include: { items: true },
    });

    if (!payment || Number(payment.branchId) !== branchId) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลการชำระเงินในสาขานี้' });
    }
    if (payment.isCancelled) {
      return res.status(400).json({ message: 'รายการนี้ถูกยกเลิกแล้ว' });
    }

    await prisma.$transaction(async (tx) => {
      // 1) Mark payment cancelled
      await tx.payment.update({ where: { id: payment.id }, data: { isCancelled: true, cancelNote: note || null, cancelledAt: new Date() } });

      // 2) Rollback deposit usage for this payment
      if (tx.depositUsage && typeof tx.depositUsage.findMany === 'function') {
        const usages = await tx.depositUsage.findMany({ where: { paymentId: payment.id } });
        for (const u of usages) {
          await tx.customerDeposit.update({
            where: { id: u.customerDepositId },
            data: { usedAmount: { decrement: u.amountUsed } },
          });
          // reopen deposit if now not fully used
          const dep = await tx.customerDeposit.findUnique({ where: { id: u.customerDepositId }, select: { usedAmount: true, totalAmount: true } });
          const used = Number(dep?.usedAmount || 0);
          const total = Number(dep?.totalAmount || 0);
          if (used < total) {
            await tx.customerDeposit.update({ where: { id: u.customerDepositId }, data: { status: 'ACTIVE' } });
          }
        }
      } else {
        // Fallback: use payment.items if schema still has customerDepositId on items
        for (const it of payment.items) {
          if (it.paymentMethod === 'DEPOSIT' && it.customerDepositId) {
            await tx.customerDeposit.update({
              where: { id: it.customerDepositId },
              data: { usedAmount: { decrement: it.amount } },
            });
            const dep = await tx.customerDeposit.findUnique({ where: { id: it.customerDepositId }, select: { usedAmount: true, totalAmount: true } });
            const used = Number(dep?.usedAmount || 0);
            const total = Number(dep?.totalAmount || 0);
            if (used < total) {
              await tx.customerDeposit.update({ where: { id: it.customerDepositId }, data: { status: 'ACTIVE' } });
            }
          }
        }
      }

      // 3) Recompute sale.paid
      const agg = await tx.paymentItem.aggregate({ _sum: { amount: true }, where: { payment: { saleId: payment.saleId, isCancelled: false } } });
      const paid = agg._sum.amount || new Prisma.Decimal(0);
      
      const saleRow = await tx.sale.findUnique({ where: { id: payment.saleId }, select: { totalAmount: true, paidAt: true } });

      const isPaid = (paid.greaterThanOrEqualTo?.(saleRow.totalAmount)) || (toNum(paid) >= toNum(saleRow.totalAmount));
      await tx.sale.update({ where: { id: payment.saleId }, data: { paid: isPaid, paidAt: isPaid ? saleRow.paidAt || new Date() : null } });
    }, { timeout: 20000, maxWait: 20000 });

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







