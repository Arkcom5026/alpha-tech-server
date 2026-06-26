// src/modules/sales/repositories/salesRepository.js
const prisma = require('../../../database/prisma/client');
const AppError = require('../../../shared/errors/AppError');

class SalesRepository {
  async processSaleTransaction(branchId, cashierId, payload, businessType) {
    const { items, paymentDetails, customerId } = payload;
    const isStructured = businessType === 'IT' || businessType === 'ELECTRONICS';

    return await prisma.$transaction(async (tx) => {
      // 1. ตรวจสอบสต็อกและปรับลดยอดพัสดุตามประเภทโครงสร้างธุรกิจ
      for (const item of items) {
        if (isStructured) {
          const stockItems = await tx.stockItem.findMany({
            where: { branchId, productId: item.productId, status: 'AVAILABLE' },
            take: item.qty
          });

          if (stockItems.length < item.qty) {
            throw new AppError(`สินค้าโครงสร้างรหัส ${item.productId} มีจำนวนซีเรียลไม่พอกับยอดขาย`, 400);
          }

          const stockIds = stockItems.map(si => si.id);
          await tx.stockItem.updateMany({
            where: { id: { in: stockIds } },
            data: { status: 'SOLD' }
          });
        } else {
          const balance = await tx.stockBalance.findUnique({
            where: { branchId_productId: { branchId, productId: item.productId } }
          });

          if (!balance || (balance.quantity - (balance.reserved || 0)) < item.qty) {
            throw new AppError(`สินค้าคงคลังรหัส ${item.productId} มีปริมาณไม่เพียงพอต่อคำสั่งซื้อ`, 400);
          }

          await tx.stockBalance.update({
            where: { branchId_productId: { branchId, productId: item.productId } },
            data: { quantity: { decrement: item.qty } }
          });
        }
      }

      // 2. ประมวลผลและกระจายสัดส่วนการคำนวณภาษี
      let subtotal = 0;
      let vatAmount = 0;
      const vatRate = 0.07; // ภาษีมูลค่าเพิ่มเดิม 7%

      items.forEach(item => {
        const itemTotal = item.qty * item.price;
        subtotal += itemTotal / (1 + vatRate);
        vatAmount += (itemTotal / (1 + vatRate)) * vatRate;
      });

      // 3. หักยอดสมดุลทางการเงิน (เงินมัดจำ หรือ เพิ่มสัดส่วนหนี้ค้างส่ง)
      for (const pay of paymentDetails) {
        if (pay.method === 'DEPOSIT' && customerId) {
          const profile = await tx.customerProfile.findUnique({ where: { id: customerId } });
          if (!profile || profile.depositBalance < pay.amount) {
            throw new AppError('ยอดเงินฝากมัดจำล่วงหน้าของลูกค้าไม่เพียงพอสำหรับการตัดชำระเงิน', 400);
          }

          await tx.customerProfile.update({
            where: { id: customerId },
            data: { depositBalance: { decrement: pay.amount } }
          });

          await tx.customerDeposit.create({
            data: {
              customerId,
              amount: pay.amount,
              transactionType: 'DEDUCTION'
            }
          });
        } else if (pay.method === 'CREDIT_AR' && customerId) {
          await tx.customerProfile.update({
            where: { id: customerId },
            data: { outstandingDebt: { increment: pay.amount } }
          });
        }
      }

      const saleCount = await tx.sale.count({ where: { branchId } });
      const invoiceNumber = `INV-${branchId.slice(0, 4).toUpperCase()}-${String(saleCount + 1).padStart(7, '0')}`;

      return await tx.sale.create({
        data: {
          invoiceNumber,
          branchId,
          cashierId,
          customerId,
          subtotal,
          vatAmount,
          grandTotal: subtotal + vatAmount,
          paymentMethod: paymentDetails.length > 1 ? 'MULTI' : paymentDetails[0].method,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              qty: item.qty,
              price: item.price
            }))
          },
          payments: {
            create: paymentDetails.map(pay => ({
              method: pay.method,
              amount: pay.amount
            }))
          }
        },
        include: {
          items: true,
          payments: true
        }
      });
    });
  }
}

module.exports = new SalesRepository();