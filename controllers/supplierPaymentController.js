const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// ✅ POST /purchase-order-payments
const createSupplierPayment = async (req, res) => {
  try {
    const {
      purchaseOrderId,
      amount,
      method,
      note,
      isRefund = false,
    } = req.body;

    const employeeId = req.user.employeeId;
    const branchId = req.user.branchId;

    const file = req.file;
    const attachmentPath = file ? `/uploads/${file.filename}` : null;

    const created = await prisma.purchaseOrderPayment.create({
      data: {
        purchaseOrderId: parseInt(purchaseOrderId),
        amount: parseFloat(amount),
        method,
        note,
        isRefund,
        attachment: attachmentPath,
        paidAt: new Date(),
        employeeId,
        branchId,
      },
    });

    // ✅ อัปเดตสถานะ PO หลังชำระ
    const payments = await prisma.purchaseOrderPayment.findMany({
      where: { purchaseOrderId: parseInt(purchaseOrderId) },
    });

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(purchaseOrderId) },
    });

    const newStatus =
      totalPaid >= Number(po.totalAmount)
        ? 'PAID'
        : totalPaid > 0
        ? 'PARTIAL'
        : 'UNPAID';

    await prisma.purchaseOrder.update({
      where: { id: parseInt(purchaseOrderId) },
      data: { status: newStatus },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('❌ [createSupplierPayment] error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกการชำระเงิน' });
  }
};

// ✅ GET /purchase-order-payments
const getAllSupplierPayments = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const payments = await prisma.purchaseOrderPayment.findMany({
      where: { branchId },
      orderBy: { paidAt: 'desc' },
      include: {
        purchaseOrder: { include: { supplier: true } },
        employee: true,
      },
    });
    res.json(payments);
  } catch (err) {
    console.error('❌ [getAllSupplierPayments] error:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลการชำระเงินได้' });
  }
};

// ✅ GET /purchase-order-payments/by-po/:poId
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

// ✅ DELETE /purchase-order-payments/:id
const deleteSupplierPayment = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const branchId = req.user.branchId;

    const payment = await prisma.purchaseOrderPayment.findFirst({
      where: { id, branchId },
    });

    if (!payment) {
      return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการลบ' });
    }

    // ลบไฟล์แนบถ้ามี
    if (payment.attachment) {
      const filePath = path.join(__dirname, '../public', payment.attachment);
      fs.unlink(filePath, (err) => {
        if (err) console.warn('⚠️ ลบไฟล์แนบไม่สำเร็จ:', err.message);
      });
    }

    await prisma.purchaseOrderPayment.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ [deleteSupplierPayment] error:', err);
    res.status(500).json({ error: 'ลบข้อมูลไม่สำเร็จ' });
  }
};

module.exports = {
  createSupplierPayment,
  getAllSupplierPayments,
  getSupplierPaymentsByPO,
  deleteSupplierPayment,
};
