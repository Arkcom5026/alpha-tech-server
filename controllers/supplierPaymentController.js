// supplierPaymentController.js

const { prisma, Prisma } = require('../lib/prisma');
const fs = require('fs');
const path = require('path');


const generateSupplierPaymentCode = async (tx, branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = new Date();
  const year = now.getFullYear().toString().slice(2); // ปี ค.ศ. 2025 → '25'
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const yymm = `${year}${month}`; // เช่น '2507'

  const count = await tx.supplierPayment.count({
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
    const {
      supplierId,
      paymentDate,
      amount,
      method,
      paymentType, // 'RECEIPT_BASED' | 'ADVANCE'
      note,
      receipts: selectedReceiptsData,
    } = req.body;

    console.log('➡️ Incoming createSupplierPayment', req.body);

    const branchId = req.user?.branchId || 1;
    const employeeId = req.user?.employeeId;

    if (!employeeId) {
      throw new Error('Missing employeeId');
    }

    const result = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true, creditBalance: true, isSystem: true },
      });

      if (!supplier) throw new Error('Supplier not found.');

      if (supplier.isSystem) {
        throw new Error('ไม่สามารถสร้างการชำระเงินให้กับซัพพลายเออร์ระบบได้');
      }

      if (paymentType === 'RECEIPT_BASED') {
        const creditOwed = Number(supplier.creditBalance || 0);
        if (Number(amount) > creditOwed + 0.0001) {
          throw new Error('ยอดชำระเกินกว่ายอดหนี้ที่มีอยู่ของ Supplier');
        }
        if (selectedReceiptsData && selectedReceiptsData.length > 0) {
          const sumOfReceiptAmounts = selectedReceiptsData.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);
          if (Math.abs(sumOfReceiptAmounts - Number(amount)) > 0.01) {
            throw new Error('ยอดรวมใบรับของที่เลือกไม่ตรงกับจำนวนเงินที่ชำระ');
          }
        }
      }

      const payment = await tx.supplierPayment.create({
        data: {
          code: await generateSupplierPaymentCode(tx, branchId),
          paidAt: new Date(paymentDate),
          amount: Number(amount),
          method,
          paymentType,
          note,
          supplier: { connect: { id: supplierId } },
          employee: { connect: { id: employeeId } },
          branch: { connect: { id: branchId } },
        },
      });

      console.log('✅ Created SupplierPayment with ID:', payment.id);

      if (paymentType === 'RECEIPT_BASED' && Array.isArray(selectedReceiptsData) && selectedReceiptsData.length > 0) {
        for (const selectedReceipt of selectedReceiptsData) {
          const { receiptId, amountPaid: requestedAmountPaid } = selectedReceipt;

          const reReceipt = await tx.purchaseOrderReceipt.findFirst({
            where: { id: receiptId, branchId },
            select: {
              id: true,
              totalAmount: true,
              paidAmount: true,
              statusReceipt: true,
              purchaseOrder: { select: { supplierId: true } },
            },
          });

          if (!reReceipt) {
            console.warn(`Receipt with ID ${receiptId} not found in this branch. Skipping.`);
            continue;
          }

          if (reReceipt.purchaseOrder?.supplierId !== supplierId) {
            console.warn(`Receipt ${receiptId} does not belong to supplier ${supplierId}. Skipping.`);
            continue;
          }

          const currentOutstanding = Number(reReceipt.totalAmount || 0) - Number(reReceipt.paidAmount || 0);
          const actualAmountToPay = Math.min(Number(requestedAmountPaid || 0), currentOutstanding);

          if (!requestedAmountPaid || isNaN(Number(requestedAmountPaid)) || actualAmountToPay <= 0) {
            console.warn(`❌ Invalid amountPaid for receipt ${receiptId}. Skipping.`);
            continue;
          }

          await tx.supplierPaymentReceipt.create({
            data: {
              paymentId: payment.id,
              receiptId: reReceipt.id,
              amountPaid: actualAmountToPay,
            },
          });
          console.log(`✅ Linked payment to receipt ${receiptId} with amountPaid: ${actualAmountToPay}`);

          const newPaidAmountForReceipt = Number(reReceipt.paidAmount || 0) + actualAmountToPay;
          let newStatus = reReceipt.statusReceipt;

          if (newPaidAmountForReceipt >= Number(reReceipt.totalAmount || 0) - 0.0001) {
            newStatus = 'PAID';
          } else if (newPaidAmountForReceipt > 0) {
            newStatus = 'PARTIALLY_PAID';
          }

          await tx.purchaseOrderReceipt.update({
            where: { id: reReceipt.id },
            data: {
              statusPayment: newStatus,
              paidAmount: newPaidAmountForReceipt,
            },
          });
        }
      }

      if (paymentType === 'ADVANCE') {
        console.log(`🔻 Decreasing supplier ${supplierId} creditBalance by ${amount} (Advance payment)`);
        await tx.supplier.update({
          where: { id: supplierId },
          data: { creditBalance: { decrement: Number(amount) } },
        });
      } else {
        console.log(`🔻 Decreasing supplier ${supplierId} creditBalance by ${amount}`);
        await tx.supplier.update({
          where: { id: supplierId },
          data: { creditBalance: { decrement: Number(amount) } },
        });
      }

      return payment;
    }, { timeout: 15000 });

    res.status(201).json(result);
  } catch (error) {
    console.error('❌ Error in createSupplierPayment:', error);
    if (String(error.message || '').includes('ซัพพลายเออร์ระบบ')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
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
        supplierPaymentReceipts: {
          include: {
            receipt: true,
          },
        },
      },
    });
    console.log('getAllSupplierPayments payments : ', payments);
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
      },
      orderBy: { paidAt: 'desc' },
      select: {
        id: true,
        code: true,
        paidAt: true,
        paymentType: true,
        amount: true,
        method: true,
        note: true,
        supplierId: true,
        employee: {
          select: {
            name: true,
          },
        },
      },
    });
      
    res.json(payments);
  } catch (err) {
    console.error('❌ getAdvancePaymentsBySupplier error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getSupplierPaymentsBySupplier = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const supplierId = parseInt(req.params.supplierId);

    if (!supplierId) {
      return res.status(400).json({ error: 'Missing supplierId parameter' });
    }

    const payments = await prisma.supplierPayment.findMany({
      where: {
        branchId,
        supplierId,
      },
      orderBy: { paidAt: 'desc' },
      include: {
        supplier: true,
        employee: true,
        supplierPaymentReceipts: {
          include: {
            receipt: true,
          },
        },
      },
    });

    res.json(payments);
  } catch (err) {
    console.error('❌ [getSupplierPaymentsBySupplier] error:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลการชำระเงินของ Supplier นี้ได้' });
  }
};

module.exports = {
  createSupplierPayment,
  getAllSupplierPayments,
  getSupplierPaymentsByPO,
  deleteSupplierPayment,
  getAdvancePaymentsBySupplier,
  getSupplierPaymentsBySupplier,
};
