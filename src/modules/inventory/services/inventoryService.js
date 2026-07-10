// src/modules/inventory/services/inventoryService.js
const inventoryRepository = require('../repositories/inventoryRepository');
const prisma = require('../../../database/prisma/client');
const AppError = require('../../../shared/errors/AppError');

class InventoryService {
  async calculateAvailableOnlineStock(branchId, businessType) {
    const rawProducts = await inventoryRepository.getProductsStockAndPricing(branchId, businessType);

    return rawProducts.map(product => {
      const branchPrice = product.branchPrices[0];
      const priceOnline = branchPrice ? branchPrice.priceOnline : null;

      let totalAvailable = 0;

      if (businessType === 'IT' || businessType === 'ELECTRONICS') {
        totalAvailable = product.stockItems ? product.stockItems.length : 0;
      } else {
        const balance = product.stockBalances[0];
        if (balance) {
          const onHand = balance.quantity || 0;
          const reserved = balance.reserved || 0;
          totalAvailable = onHand - reserved;
        }
      }

      return {
        id: product.id,
        name: product.name,
        category: product.productType?.globalProductType?.category?.name ?? 'Unassigned',
        priceOnline,
        availableStock: totalAvailable < 0 ? 0 : totalAvailable,
        mode: businessType === 'IT' || businessType === 'ELECTRONICS' ? 'STRUCTURED' : 'SIMPLE'
      };
    });
  }

  async processStockAudit(branchId, auditorId, auditItems) {
    return await prisma.$transaction(async (tx) => {
      const audit = await tx.stockAudit.create({
        data: {
          branchId,
          auditorId,
          status: 'ADJUSTED'
        }
      });

      for (const item of auditItems) {
        const balance = await tx.stockBalance.findUnique({
          where: {
            branchId_productId: { branchId, productId: item.productId }
          }
        });

        const currentQty = balance ? (balance.quantity - (balance.reserved || 0)) : 0;
        const difference = item.actualQty - currentQty;

        await tx.stockAuditItem.create({
          data: {
            stockAuditId: audit.id,
            productId: item.productId,
            expectedQty: currentQty,
            actualQty: item.actualQty,
            difference: difference
          }
        });

        await tx.stockBalance.upsert({
          where: {
            branchId_productId: { branchId, productId: item.productId }
          },
          update: {
            quantity: item.actualQty // การปรองดองยอด (Reconciliation) ตามยอดจริงหน้าร้าน
          },
          create: {
            branchId,
            productId: item.productId,
            quantity: item.actualQty,
            reserved: 0
          }
        });
      }

      return audit;
    });
  }
}

module.exports = new InventoryService();