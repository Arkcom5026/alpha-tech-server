// src/modules/finance/services/financeService.js
const prisma = require('../../../database/prisma/client');
const AppError = require('../../../shared/errors/AppError');

class FinanceService {
  async generateTaxReport(branchId, startDate, endDate) {
    const sales = await prisma.sale.findMany({
      where: {
        branchId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        },
        status: 'COMPLETED'
      }
    });

    let totalRevenue = 0;
    let taxableAmount = 0;
    let totalVatCollected = 0;

    sales.forEach(sale => {
      totalRevenue += sale.grandTotal;
      taxableAmount += sale.subtotal;
      totalVatCollected += sale.vatAmount;
    });

    return {
      branchId,
      period: { startDate, endDate },
      totalInvoices: sales.length,
      financials: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        taxableAmount: parseFloat(taxableAmount.toFixed(2)),
        totalVatCollected: parseFloat(totalVatCollected.toFixed(2))
      }
    };
  }

  async registerCustomerDeposit(branchId, customerId, amount) {
    if (amount <= 0) {
      throw new AppError('จำนวนมูลค่าเงินฝากจำเป็นต้องมากกว่าศูนย์', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const profile = await tx.customerProfile.findUnique({ where: { id: customerId } });

      if (!profile || profile.branchId !== branchId) {
        throw new AppError('ไม่พบข้อมูลโปรไฟล์ประวัติของลูกค้าในเครือข่ายของสาขานี้', 404);
      }

      const updatedProfile = await tx.customerProfile.update({
        where: { id: customerId },
        data: { depositBalance: { increment: amount } }
      });

      const depositRecord = await tx.customerDeposit.create({
        data: {
          customerId,
          amount,
          transactionType: 'DEPOSIT'
        }
      });

      return {
        depositRecord,
        newBalance: updatedProfile.depositBalance
      };
    });
  }
}

module.exports = new FinanceService();