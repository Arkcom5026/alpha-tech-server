// src/modules/repair/services/repairService.js
const prisma = require('../../../database/prisma/client');  // ถอย 3 ชั้นเพื่อออกไปหา src/database
const AppError = require('../../../shared/errors/AppError'); // ถอย 3 ชั้นเพื่อออกไปหา src/shared

class RepairService {
  /**
   * 1. บันทึกเปิดใบรับซ่อมสินค้าใหม่หน้าร้าน (Create Repair Job)
   */
  async createRepairJob(branchId, payload) {
    const { customerId, stockItemId, deviceModel, reportedSymptoms, depositPaid, estimatedCost } = payload;

    return await prisma.$transaction(async (tx) => {
      // ตรวจสอบข้อมูลลูกค้าก่อนเปิดบิล
      const customer = await tx.customerProfile.findUnique({ where: { id: customerId } });
      if (!customer) throw new AppError('ไม่พบข้อมูลประวัติลูกค้าในระบบสาขา', 404);

      // ถ้ามีการระบุ Serial Number (stockItemId) ให้เช็กสถานะสต็อกและประกัน
      if (stockItemId) {
        const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
        if (!item) throw new AppError('ไม่พบข้อมูลหมายเลขซีเรียล (Serial Number) นี้ในระบบคลัง', 404);
      }

      // คำนวณรันเลขใบงานซ่อมอัตโนมัติ (เช่น RE-2026-00001)
      const jobCount = await tx.repairJob.count({ where: { branchId } });
      const jobNo = `RE-${branchId}-${String(jobCount + 1).padStart(5, '0')}`;

      return await tx.repairJob.create({
        data: {
          jobNo,
          branchId,
          customerId,
          stockItemId,
          deviceModel,
          reportedSymptoms,
          depositPaid: depositPaid || 0.0,
          estimatedCost: estimatedCost || 0.0,
          status: 'RECEIVED' // สเตทเริ่มต้น: รับเครื่องเข้าสู่ระบบ
        },
        include: { customer: true, stockItem: true }
      });
    });
  }

  /**
   * 2. ระบบช่างเบิกอะไหล่ซ่อม และตัดยอดสต็อกสินค้าคลังทันที (Spare Parts Deduction Engine)
   */
  async addPartsToRepairJob(branchId, repairJobId, payload) {
    const { productId, qtyUsed } = payload;

    return await prisma.$transaction(async (tx) => {
      // ตรวจสอบว่าใบซ่อมนี้มีอยู่จริงไหม
      const job = await tx.repairJob.findUnique({ where: { id: repairJobId } });
      if (!job || job.branchId !== branchId) throw new AppError('ไม่พบข้อมูลใบสั่งงานซ่อมนี้ในสาขาของท่าน', 404);

      // ตรวจเช็กจำนวนสต็อกอะไหล่คงเหลือในสาขาจริง
      const stockBalance = await tx.stockBalance.findUnique({
        where: { productId_branchId: { productId, branchId } }
      });

      if (!stockBalance || stockBalance.quantity < qtyUsed) {
        throw new AppError('ปริมาณสินค้าอะไหล่ในคลังของสาขามีจำนวนไม่เพียงพอต่อการเบิกใช้ซ่อม', 400);
      }

      // ดึงราคาทุนหรือราคาช่างล่าสุดมาบันทึกผูกยอดการเงิน
      const branchPrice = await tx.branchPrice.findUnique({
        where: { productId_branchId: { productId, branchId } }
      });
      const unitPrice = branchPrice ? branchPrice.priceTechnician || branchPrice.priceRetail : 0;

      // 1. บันทึกประวัติการใช้อะไหล่เข้าสู่เคส
      const partItem = await tx.repairPartItem.create({
        data: { repairJobId, productId, qtyUsed, unitPrice }
      });

      // 2. หักลดจำนวนสต็อกในคลังสินค้าคลังทันที
      await tx.stockBalance.update({
        where: { productId_branchId: { productId, branchId } },
        data: { quantity: { decrement: qtyUsed } }
      });

      // 3. บันทึกบัญชีเดินสะพัดประวัติสต็อกเคลื่อนไหว (Stock Movement)
      await tx.stockMovement.create({
        data: {
          productId,
          branchId,
          qty: -qtyUsed,
          type: 'ADJUST',
          note: `เบิกใช้อะไหล่สำหรับใบงานซ่อมเลขที่: ${job.jobNo}`
        }
      });

      return partItem;
    });
  }

  /**
   * 3. ปรับเปลี่ยนสถานะงานซ่อมตามจริง (State Machine Lifecycle)
   */
  async updateJobStatus(branchId, repairJobId, payload) {
    const { status, technicianNotes, technicianId } = payload;

    const job = await tx.repairJob.findUnique({ where: { id: repairJobId } });
    if (!job || job.branchId !== branchId) throw new AppError('ไม่พบข้อมูลเอกสารงานซ่อมนี้', 404);

    return await prisma.repairJob.update({
      where: { id: repairJobId },
      data: { 
        status, // RECEIVED, IN_PROGRESS, WAITING_PARTS, COMPLETED, CANCELLED
        technicianNotes,
        technicianId
      }
    });
  }
}

module.exports = new RepairService();