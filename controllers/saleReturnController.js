// controllers/saleReturnController.js — Prisma singleton, Decimal-safe, BRANCH_SCOPE_ENFORCED
const { prisma, Prisma } = require('../lib/prisma');
const dayjs = require('dayjs');

// helpers
const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v ?? 0));
const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v || 0));
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : parseInt(v, 10));

// Generate running code: RT-<BR><YYMM>-####
const generateReturnCode = async (client, branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = dayjs();
  const prefix = `RT-${paddedBranch}${now.format('YYMM')}`;

  const count = await client.saleReturn.count({
    where: {
      branchId: Number(branchId),
      createdAt: {
        gte: now.startOf('month').toDate(),
        lt: now.endOf('month').toDate(),
      },
    },
  });

  const running = String(count + 1).padStart(4, '0');
  return `${prefix}-${running}`;
};

// POST /sale-returns
const createSaleReturn = async (req, res) => {
  try {
    const { saleId, reason, items } = req.body || {};
    const branchId = toInt(req.user?.branchId);
    const employeeId = toInt(req.user?.employeeId);

    if (!branchId || !employeeId) {
      return res.status(401).json({ message: 'Unauthenticated: missing branch/employee context' });
    }

    const saleIdNum = toInt(saleId);
    if (!saleIdNum) {
      return res.status(400).json({ message: 'saleId ไม่ถูกต้อง' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'ต้องเลือกรายการสินค้าที่จะคืน' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1) Load sale under branch scope (+ items)
      const sale = await tx.sale.findFirst({
        where: { id: saleIdNum, branchId },
        include: { items: true },
      });
      if (!sale) throw new Error('ไม่พบรายการขายนี้ในสาขาของคุณ');

      // 2) Validate & prepare return items
      let totalRefundDec = new Prisma.Decimal(0);
      const itemData = [];

      for (const i of items) {
        const saleItemId = toInt(i?.saleItemId);
        if (!saleItemId) throw new Error('saleItemId ไม่ถูกต้อง');

        const saleItem = await tx.saleItem.findUnique({
          where: { id: saleItemId },
          include: { stockItem: true },
        });

        if (!saleItem || saleItem.saleId !== sale.id) {
          throw new Error(`ไม่พบ saleItem หรือไม่ตรงกับใบขาย: ${saleItemId}`);
        }
        if (!saleItem.stockItem) {
          throw new Error(`saleItem ${saleItemId} ไม่มีข้อมูลสต๊อกที่ผูกไว้`);
        }
        if (saleItem.stockItem.status === 'RETURNED') {
          throw new Error(`สินค้าชิ้นนี้ถูกคืนไปแล้ว: ${saleItemId}`);
        }

        // 2.1) mark stock as RETURNED (atomic in the same tx)
        await tx.stockItem.update({
          where: { id: saleItem.stockItemId },
          data: { status: 'RETURNED' },
        });

        const lineRefund = D(saleItem.price); // ใช้ราคาตอนขาย (field: price)
        totalRefundDec = totalRefundDec.plus(lineRefund);

        itemData.push({
          saleItemId: saleItemId,
          refundAmount: lineRefund,
          reason: i.reason || reason || '',
          reasonCode: i.reasonCode || '',
        });
      }

      // 3) Create return header + items
      const code = await generateReturnCode(tx, branchId);

      const created = await tx.saleReturn.create({
        data: {
          code,
          saleId: sale.id,
          employeeId,
          branchId,
          totalRefund: totalRefundDec,
          refundedAmount: new Prisma.Decimal(0),
          deductedAmount: new Prisma.Decimal(0),
          isFullyRefunded: false,
          refundMethod: '',
          status: 'PENDING',
          returnType: 'REFUND',
          reason: reason || '',
          items: { create: itemData },
        },
      });

      return created;
    }, { timeout: 20000 });

    return res.status(201).json({ message: 'สร้างใบคืนสินค้าเรียบร้อย', returnCode: result.code });
  } catch (error) {
    console.error('❌ [createSaleReturn] Error:', {
      message: error?.message || String(error),
      saleId: req.body?.saleId,
      branchId: req.user?.branchId,
      employeeId: req.user?.employeeId,
    });

    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('ไม่พบรายการขาย') || msg.includes('saleitem')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการคืนสินค้า' });
  }
};

// GET /sale-returns
const getAllSaleReturns = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const saleReturns = await prisma.saleReturn.findMany({
      where: { branchId },
      orderBy: { createdAt: 'desc' },
      include: {
        sale: { include: { customer: true } },
        items: true,
      },
    });

    const resultWithTotal = saleReturns.map((sr) => {
      const totalItemRefundDec = (sr.items || []).reduce(
        (sum, item) => sum.plus(D(item.refundAmount)),
        new Prisma.Decimal(0)
      );
      const refundedAmountDec = D(sr.refundedAmount);
      const deductedAmountDec = D(sr.deductedAmount);

      return {
        ...sr,
        totalRefund: toNum(totalItemRefundDec),
        refundedAmount: toNum(refundedAmountDec),
        deductedAmount: toNum(deductedAmountDec),
        remainingAmount: toNum(totalItemRefundDec.minus(refundedAmountDec.plus(deductedAmountDec))),
        isFullyRefunded: refundedAmountDec.plus(deductedAmountDec).gte(totalItemRefundDec),
      };
    });

    return res.status(200).json(resultWithTotal);
  } catch (error) {
    console.error('❌ [getAllSaleReturns] Error:', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายการใบคืนสินค้าได้' });
  }
};

// GET /sale-returns/:id
const getSaleReturnById = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    const branchId = toInt(req.user?.branchId);

    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const saleReturn = await prisma.saleReturn.findFirst({
      where: { id, branchId },
      include: {
        sale: { include: { customer: true } },
        items: {
          include: {
            saleItem: {
              include: {
                stockItem: { include: { product: true } },
              },
            },
          },
        },
        refundTransaction: true,
      },
    });

    if (!saleReturn) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลใบคืนสินค้า' });
    }

    const totalItemRefundDec = (saleReturn.items || []).reduce(
      (sum, item) => sum.plus(D(item.refundAmount)),
      new Prisma.Decimal(0)
    );
    const refundedAmountDec = (saleReturn.refundTransaction || []).reduce(
      (sum, r) => sum.plus(D(r.amount)),
      new Prisma.Decimal(0)
    );
    const deductedAmountDec = (saleReturn.refundTransaction || []).reduce(
      (sum, r) => sum.plus(D(r.deducted)),
      new Prisma.Decimal(0)
    );

    return res.status(200).json({
      ...saleReturn,
      totalRefund: toNum(totalItemRefundDec),
      refundedAmount: toNum(refundedAmountDec),
      deductedAmount: toNum(deductedAmountDec),
      remainingAmount: toNum(totalItemRefundDec.minus(refundedAmountDec.plus(deductedAmountDec))),
      isFullyRefunded: refundedAmountDec.plus(deductedAmountDec).gte(totalItemRefundDec),
    });
  } catch (error) {
    console.error('❌ [getSaleReturnById] error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการโหลดข้อมูลใบคืนสินค้า' });
  }
};

module.exports = {
  createSaleReturn,
  getAllSaleReturns,
  getSaleReturnById,
};