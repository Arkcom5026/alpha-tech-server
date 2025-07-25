// controllers/saleReturnController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');

const generateReturnCode = async (branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = dayjs();
  const prefix = `RT-${paddedBranch}${now.format('YYMM')}`;

  const count = await prisma.saleReturn.count({
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

const createSaleReturn = async (req, res) => {
  try {
    const { saleId, reason, items } = req.body;
    const branchId = req.user?.branchId;
    const employeeId = req.user?.employeeId;

    console.log('💬 req.body.saleId:', saleId);
    console.log('💬 req.user.branchId:', branchId);
    console.log('💬 req.user.employeeId:', employeeId);

    const saleIdNum = parseInt(saleId, 10);
    if (isNaN(saleIdNum)) {
      return res.status(400).json({ message: 'saleId ไม่ถูกต้อง' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'ต้องเลือกรายการสินค้าที่จะคืน' });
    }

    const sale = await prisma.sale.findFirst({
      where: {
        id: saleIdNum,
        branchId: branchId,
      },
      include: {
        items: true,
      },
    });

    if (!sale) {
      return res.status(404).json({ message: 'ไม่พบรายการขายนี้ในสาขาของคุณ' });
    }

    const code = await generateReturnCode(branchId);
    let totalRefund = 0;

    const itemData = await Promise.all(items.map(async (i) => {
      const saleItem = await prisma.saleItem.findUnique({
        where: { id: i.saleItemId },
        include: { stockItem: true },
      });

      if (!saleItem || saleItem.saleId !== sale.id) {
        throw new Error(`ไม่พบ saleItem หรือไม่ตรงกับใบขาย: ${i.saleItemId}`);
      }

      if (saleItem.stockItem.status === 'RETURNED') {
        throw new Error(`สินค้าชิ้นนี้ถูกคืนไปแล้ว: ${i.saleItemId}`);
      }

      await prisma.stockItem.update({
        where: { id: saleItem.stockItemId },
        data: { status: 'RETURNED' },
      });

      totalRefund += saleItem.price;

      return {
        saleItemId: i.saleItemId,
        refundAmount: saleItem.price,
        reason: i.reason || '',
        reasonCode: i.reasonCode || '',
      };
    }));

    const created = await prisma.saleReturn.create({
      data: {
        code,
        saleId: sale.id,
        employeeId: Number(employeeId),
        branchId: Number(branchId),
        totalRefund: totalRefund,
        refundedAmount: 0,
        deductedAmount: 0,
        isFullyRefunded: false,
        refundMethod: '',
        status: 'PENDING',
        returnType: 'REFUND',
        items: {
          create: itemData,
        },
      },
    });

    return res.status(201).json({ message: 'สร้างใบคืนสินค้าเรียบร้อย', returnCode: created.code });
  } catch (error) {
    console.error("❌ [createSaleReturn] Error:", {
      error,
      saleId: req.body?.saleId,
      branchId: req.user?.branchId,
      employeeId: req.user?.employeeId,
    });
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการคืนสินค้า' });
  }
};

const getAllSaleReturns = async (req, res) => {
  try {
    const branchId = req.user?.branchId;

    const saleReturns = await prisma.saleReturn.findMany({
      where: { branchId: Number(branchId) },
      orderBy: { createdAt: 'desc' },
      include: {
        sale: {
          include: { customer: true },
        },
        items: true,
      },
    });

    const resultWithTotal = saleReturns.map((sr) => {
      const totalItemRefund = sr.items.reduce((sum, item) => sum + (item.refundAmount || 0), 0);
      const refundedAmount = sr.refundedAmount || 0;
      const deductedAmount = sr.deductedAmount || 0;

      return {
        ...sr,
        totalRefund: totalItemRefund,
        refundedAmount,
        deductedAmount,
        remainingAmount: totalItemRefund - (refundedAmount + deductedAmount),
        isFullyRefunded: refundedAmount + deductedAmount >= totalItemRefund,
      };
    });

    return res.status(200).json(resultWithTotal);
  } catch (error) {
    console.error('❌ [getAllSaleReturns] Error:', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายการใบคืนสินค้าได้' });
  }
};

const getSaleReturnById = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = req.user?.branchId;

    const saleReturn = await prisma.saleReturn.findFirst({
      where: {
        id: Number(id),
        branchId: Number(branchId),
      },
      include: {
        sale: {
          include: { customer: true },
        },
        items: {
          include: {
            saleItem: {
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
        refundTransaction: true,
      },
    });

    if (!saleReturn) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลใบคืนสินค้า' });
    }

    const totalRefund = saleReturn.items.reduce((sum, item) => sum + (item.refundAmount || 0), 0);
    const refundedAmount = (saleReturn.refundTransaction || []).reduce(
      (sum, r) => sum + (r.amount || 0),
      0
    );

    return res.status(200).json({
      ...saleReturn,
      totalRefund,
      refundedAmount,
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
