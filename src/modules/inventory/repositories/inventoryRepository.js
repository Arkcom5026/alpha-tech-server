// src/modules/inventory/repositories/inventoryRepository.js
const prisma = require('../../../database/prisma/client');

class InventoryRepository {
  async getProductsStockAndPricing(branchId, businessType) {
    const isStructured = businessType === 'IT' || businessType === 'ELECTRONICS';

    const include = {
      productType: {
        include: {
          globalProductType: {
            include: {
              category: true
            }
          }
        }
      },
      branchPrices: {
        where: { branchId }
      },
      stockBalances: {
        where: { branchId }
      }
    };

    // หลีกเลี่ยงข้อผิดพลาดหากนำไปใช้กับ Prisma เวอร์ชันที่ไม่ยอมรับ boolean 'false' ในการ include
    if (isStructured) {
      include.stockItems = {
        where: { branchId, status: 'AVAILABLE' }
      };
    }

    return await prisma.product.findMany({
      where: { productType: { branchId } },
      include
    });
  }
}

module.exports = new InventoryRepository();