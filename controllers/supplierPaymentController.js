const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// ✅ POST /supplier-payments
const createSupplierPayment = async (req, res) => {
  try {
    const { debitAmount, creditAmount, method, note, paymentType, pos = [] } = req.body;
    const employeeId = req.user.employeeId;
    const branchId = req.user.branchId;

    const created = await prisma.supplierPayment.create({
      data: {
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

    // ✅ ถ้าเป็นแบบ PO_BASED → สร้างรายการเชื่อมโยง PO + หักเครดิต
    if (paymentType === 'PO_BASED' && Array.isArray(pos)) {
      for (const entry of pos) {
        const poId = parseInt(entry.poId);
        const amountPaid = parseFloat(entry.amountPaid);

        if (!isNaN(poId) && amountPaid > 0) {
          await prisma.supplierPaymentPO.create({
            data: {
              supplierPaymentId: created.id,
              purchaseOrderId: poId,
              amountPaid,
            },
          });

          // ✅ หักเครดิตจาก supplier (เฉพาะ PO_BASED เท่านั้น)
          await prisma.supplier.update({
            where: { id: created.supplierId },
            data: {
              creditRemaining: {
                decrement: amountPaid,
              },
            },
          });
        }
      }
    }

    // ✅ ถ้าเป็น ADVANCE หรือ CREDIT_NOTE → ไม่หักเครดิตทันที
    res.status(201).json(created);
  } catch (err) {
    console.error('❌ [createSupplierPayment] error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกการชำระเงิน' });
  }
};

// ✅ GET /supplier-payments
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

// ✅ GET /supplier-payments/by-po/:poId (เฉพาะกรณีเก่าที่ผูก PO)
const getSupplierPaymentsByPO = async (req, res) => {
  try {
    const poId = parseInt(req.params.poId);
    const branchId = req.user.branchId;

    const payments = await prisma.purchaseOrderPayment.findMany({
      where: {
        purchaseOrderId: poId,
        branchId,
      },
      orderBy: { paidAt: 'asc' },
      include: {
        employee: true,
      },
    });

    res.json(payments);
  } catch (err) {
    console.error('❌ [getSupplierPaymentsByPO] error:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลการชำระของ PO นี้ได้' });
  }
};

// ✅ DELETE /supplier-payments/:id
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
          none: {}, // ยังไม่ถูกผูกกับ PO
        },
      },
      orderBy: { paidAt: 'desc' }, // ✅ ใช้ field ที่มีอยู่จริง
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
