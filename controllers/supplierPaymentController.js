// supplierPaymentController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const generateSupplierPaymentCode = async (branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = new Date();
  const year = now.getFullYear().toString().slice(2); // ปี ค.ศ. 2025 → '25'
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const yymm = `${year}${month}`; // เช่น '2507'

  const count = await prisma.supplierPayment.count({
    where: {
      branchId,
      paidAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    },
  });

  const sequence = `${(count + 1).toString().padStart(4, '0')}`;
  return `SP-${paddedBranch}${yymm}-${sequence}`;
};

const createSupplierPayment = async (req, res) => {
  try {
    const { debitAmount, creditAmount, method, note, paymentType, pos = [] } = req.body;
    const employeeId = req.user.employeeId;
    const branchId = req.user.branchId;

    const code = await generateSupplierPaymentCode(branchId);

    const created = await prisma.supplierPayment.create({
      data: {
        code,
        supplierId: parseInt(req.body.supplierId),
        debitAmount: parseFloat(debitAmount) || 0,
        creditAmount: parseFloat(creditAmount) || 0,
        method,
        note,
        paidAt: new Date(),
        employeeId,
        branchId,
        paymentType,
      },
    });

    if (paymentType === 'PO_BASED' && Array.isArray(pos)) {
      for (const entry of pos) {
        const poId = parseInt(entry.poId);
        const amountPaid = parseFloat(entry.amountPaid);

        if (!isNaN(poId) && amountPaid > 0) {
          const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
          const newRemaining = po.remainingAmount - amountPaid;

          let newPaymentStatus = 'UNPAID';
          if (newRemaining <= 0) {
            newPaymentStatus = 'PAID';
          } else if (newRemaining < po.totalAmount) {
            newPaymentStatus = 'PARTIALLY_PAID';
          }

          await prisma.supplierPaymentPO.create({
            data: {
              payment: { connect: { id: created.id } },
              purchaseOrder: { connect: { id: poId } },
              amountPaid,
            },
          });

          await prisma.purchaseOrder.update({
            where: { id: poId },
            data: {
              remainingAmount: newRemaining,
              paymentStatus: newPaymentStatus,
            },
          });

          await prisma.supplier.update({
            where: { id: created.supplierId },
            data: {
              creditBalance: {
                decrement: amountPaid,
              },
            },
          });
        }
      }
    }

    res.status(201).json(created);
  } catch (err) {
    console.error('❌ [createSupplierPayment] error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกการชำระเงิน' });
  }
};

const getAllSupplierPayments = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const payments = await prisma.supplierPayment.findMany({
      where: { branchId },
      orderBy: { paidAt: 'desc' },
      include: {
        supplier: true,
        employee: true,
      },
    });
    res.json(payments);
  } catch (err) {
    console.error('❌ [getAllSupplierPayments] error:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลการชำระเงินได้' });
  }
};

const getSupplierPaymentsByPO = async (req, res) => {
  try {
    const poId = parseInt(req.params.poId);
    const branchId = req.user.branchId;

    const payments = await prisma.supplierPaymentPO.findMany({
      where: {
        purchaseOrderId: poId,
        supplierPayment: {
          branchId,
        },
      },
      orderBy: {
        supplierPayment: {
          paymentDate: 'asc',
        },
      },
      include: {
        supplierPayment: {
          include: {
            createdBy: true,
          },
        },
      },
    });

    res.json(payments);
  } catch (err) {
    console.error('❌ [getSupplierPaymentsByPO] error:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลการชำระของ PO นี้ได้' });
  }
};

const deleteSupplierPayment = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const branchId = req.user.branchId;

    const payment = await prisma.supplierPayment.findFirst({
      where: { id, branchId },
    });

    if (!payment) {
      return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการลบ' });
    }

    await prisma.supplierPayment.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ [deleteSupplierPayment] error:', err);
    res.status(500).json({ error: 'ลบข้อมูลไม่สำเร็จ' });
  }
};

const getAdvancePaymentsBySupplier = async (req, res) => {
  try {
    const { supplierId } = req.query;

    if (!supplierId) {
      return res.status(400).json({ message: 'supplierId is required' });
    }

    const payments = await prisma.supplierPayment.findMany({
      where: {
        supplierId: parseInt(supplierId),
        paymentType: 'ADVANCE',
        SupplierPaymentPO: {
          none: {},
        },
      },
      orderBy: { paidAt: 'desc' },
    });

    res.json(payments);
  } catch (err) {
    console.error('❌ getAdvancePaymentsBySupplier error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  createSupplierPayment,
  getAllSupplierPayments,
  getSupplierPaymentsByPO,
  deleteSupplierPayment,
  getAdvancePaymentsBySupplier,
};
