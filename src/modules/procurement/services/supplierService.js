// src/modules/procurement/services/supplierService.js
const prisma = require('../../../database/prisma/client');
const AppError = require('../../../shared/errors/AppError');

class SupplierService {
  /**
   * ลงทะเบียนบัญชีผู้จัดจำหน่ายรายใหม่ในระบบเมืองใหม่ v2
   */
  async createSupplier(branchId, payload, txClient = prisma) {
    const { name, contactName, phone, email, address, creditBalance } = payload;
    
    if (!name) {
      throw new AppError('กรุณาระบุข้อมูลชื่อผู้จัดจำหน่ายในแบบฟอร์มลงทะเบียน', 400);
    }

    return await txClient.supplier.create({
      data: {
        name,
        contactName,
        phone,
        email,
        address,
        creditBalance: parseFloat(creditBalance || 0),
        outstandingBalance: 0.0, // ยอดหนี้ค้างส่งเริ่มต้นตั้งค่าเป็นศูนย์
        branchId
      }
    });
  }

  /**
   * ค้นหาประวัติคู่จัดส่งที่ได้รับอนุญาตประจำพิกัดสาขา
   */
  async getSupplierById(supplierId, branchId, txClient = prisma) {
    const supplier = await txClient.supplier.findFirst({
      where: { id: supplierId, branchId }
    });

    if (!supplier) {
      throw new AppError('ไม่พบข้อมูลประวัติคู่ค้าผู้ส่งมอบในสารบบของสาขานี้', 404);
    }

    return supplier;
  }

  /**
   * หักลดวงเงินเครดิตคงเหลือในกระเป๋าของคู่จัดจำหน่าย (Deduct Supplier Credit)
   */
  async deductSupplierCredit(supplierId, amount, txClient = prisma) {
    const supplier = await txClient.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier) {
      throw new AppError('ไม่พบข้อมูลประวัติคู่จัดจำหน่ายเพื่อตัดวงเงินเครดิต', 404);
    }

    const currentBalance = supplier.creditBalance ?? 0;
    if (currentBalance < amount) {
      throw new AppError(
        `ยอดเงินวงเงินเครดิตของผู้จัดจำหน่ายไม่เพียงพอ (วงเงินคงเหลือในระบบ: ${currentBalance.toFixed(2)}, ยอดหักประเมิน: ${amount.toFixed(2)})`,
        400
      );
    }

    return await txClient.supplier.update({
      where: { id: supplierId },
      data: {
        creditBalance: { decrement: amount }
      }
    });
  }

  /**
   * บวกเครดิตบาลานซ์คืนผู้ค้ากรณีเกิดส่วนลดหรือส่งมอบพัสดุไม่ตรงตามกำหนด (Refund Supplier Credit)
   */
  async refundSupplierCredit(supplierId, amount, txClient = prisma) {
    return await txClient.supplier.update({
      where: { id: supplierId },
      data: {
        creditBalance: { increment: amount }
      }
    });
  }
}

module.exports = new SupplierService(); 