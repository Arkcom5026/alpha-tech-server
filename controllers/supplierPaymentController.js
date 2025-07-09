// supplierPaymentController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
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
      amount, // Total amount of this payment transaction
      method,
      paymentType, // 'RECEIPT_BASED' for paying off receipts, 'ADVANCE' for advance payments
      note,
      receipts: selectedReceiptsData, // This will be an array of { receiptId, amountPaid } from frontend
    } = req.body;

    console.log('➡️ Incoming createSupplierPayment', req.body);

    const branchId = req.user?.branchId || 1; // fallback for mock or test
    const employeeId = req.user?.employeeId;

    if (!employeeId) {
      throw new Error('Missing employeeId');
    }

    const result = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({
        where: { id: supplierId },
        select: { creditBalance: true },
      });

      if (!supplier) throw new Error('Supplier not found.');

      // --- FIX [1]: Check credit balance only when paying off debt (RECEIPT_BASED) ---
      // For ADVANCE payments, this check is skipped.
      if (paymentType === 'RECEIPT_BASED') {
        if (amount > supplier.creditBalance) {
          throw new Error('ยอดชำระเกินกว่ายอดเครดิตที่เหลือของ Supplier');
        }
        if (selectedReceiptsData && selectedReceiptsData.length > 0) {
            const sumOfReceiptAmounts = selectedReceiptsData.reduce((sum, r) => sum + r.amountPaid, 0);
            if (Math.abs(sumOfReceiptAmounts - amount) > 0.01) {
              throw new Error('ยอดรวมใบรับของที่เลือกไม่ตรงกับจำนวนเงินที่ชำระ');
            }
        }
      }


      const payment = await tx.supplierPayment.create({
        data: {
          code: await generateSupplierPaymentCode(tx, branchId),
          paidAt: new Date(paymentDate),
          amount,
          method,
          paymentType,
          note,
          supplier: { connect: { id: supplierId } },
          employee: { connect: { id: employeeId } },
          branch: { connect: { id: branchId } },
        },
      });

      console.log('✅ Created SupplierPayment with ID:', payment.id);

      // This block for handling receipts will only run if it's a RECEIPT_BASED payment, which is correct.
      if (paymentType === 'RECEIPT_BASED' && selectedReceiptsData && selectedReceiptsData.length > 0) {
        for (const selectedReceipt of selectedReceiptsData) {
          const { receiptId, amountPaid: requestedAmountPaid } = selectedReceipt;

          const reReceipt = await tx.purchaseOrderReceipt.findUnique({
            where: { id: receiptId },
            select: { totalAmount: true, paidAmount: true, statusReceipt: true },
          });

          if (!reReceipt) {
            console.warn(`Receipt with ID ${receiptId} not found. Skipping.`);
            continue;
          }

          const currentOutstanding = (reReceipt.totalAmount || 0) - (reReceipt.paidAmount || 0);
          const actualAmountToPay = Math.min(requestedAmountPaid, currentOutstanding);

          if (actualAmountToPay <= 0) {
            console.warn(`Amount to pay for receipt ${receiptId} is zero or negative or fully paid. Skipping.`);
            continue;
          }

          if (!requestedAmountPaid || isNaN(requestedAmountPaid)) {
            console.warn(`❌ Invalid amountPaid for receipt ${receiptId}. Skipping.`);
            continue;
          }

          await tx.supplierPaymentReceipt.create({
            data: {
              paymentId: payment.id,
              receiptId: receiptId,
              amountPaid: actualAmountToPay,
            },
          });
          console.log(`✅ Created SupplierPaymentReceipt for receipt ${receiptId} with amountPaid: ${actualAmountToPay}`);

          const newPaidAmountForReceipt = (reReceipt.paidAmount || 0) + actualAmountToPay;
          let newStatus = reReceipt.statusReceipt;

          if (newPaidAmountForReceipt >= reReceipt.totalAmount) {
            newStatus = 'PAID';
          } else if (newPaidAmountForReceipt > 0 && newPaidAmountForReceipt < reReceipt.totalAmount) {
            newStatus = 'PARTIALLY_PAID';
          }

          console.log(`✅ Updating receipt ${receiptId} statusReceipt to ${newStatus} and paidAmount to ${newPaidAmountForReceipt}`);
          await tx.purchaseOrderReceipt.update({
            where: { id: receiptId },
            data: {
              statusPayment: newStatus,
              paidAmount: newPaidAmountForReceipt,
            },
          });
        }
      }

      // --- FIX [2]: Adjust credit balance based on paymentType ---
      if (paymentType === 'ADVANCE') {
        // For ADVANCE payments, INCREMENT the credit balance.
        console.log(`🔼 Increasing supplier ${supplierId} creditBalance by ${amount}`);
        await tx.supplier.update({
          where: { id: supplierId },
          data: {
            creditBalance: { increment: amount },
          },
        });
      } else {
        // For RECEIPT_BASED payments, DECREMENT the credit balance as before.
        console.log(`🔻 Decreasing supplier ${supplierId} creditBalance by ${amount}`);
        await tx.supplier.update({
          where: { id: supplierId },
          data: {
            creditBalance: { decrement: amount },
          },
        });
      }

      return payment;
    }, {
      timeout: 15000
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('❌ Error in createSupplierPayment:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};


const getAllSupplierPayments = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    console.log('getAllSupplierPayments branchId : ', branchId);

    const payments = await prisma.supplierPayment.findMany({
      where: { branchId },
      orderBy: { paidAt: 'desc' },
      include: {
        supplier: true,
        employee: true,
        supplierPaymentReceipts: {
          include: {
            receipt: true, // ✅ เปลี่ยนจาก purchaseOrderReceipt เป็น receipt ตาม schema Prisma ล่าสุด
          },
        },
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
        paymentType: 'ADVANCE', // <-- ✅ **CRITICAL FIX**: Only fetch ADVANCE payments
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


module.exports = {
  createSupplierPayment,
  getAllSupplierPayments,
  getSupplierPaymentsByPO,
  deleteSupplierPayment,
  getAdvancePaymentsBySupplier,
};
