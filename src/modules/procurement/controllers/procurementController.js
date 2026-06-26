// src/modules/procurement/controllers/procurementController.js
// 🏛️ Next-Gen Procurement Controller: (Defensive Split Logic, Zero Loop Hang & Unified JSON Response)
const supplierService = require('../services/supplierService');
const purchaseOrderService = require('../services/purchaseOrderService');
const AppError = require('../../../shared/errors/AppError');

class ProcurementController {
  /**
   * 🟢 [MIGRATION RESOLVED] ดึงรายการเอกสารและประวัติจัดซื้อทั้งหมดประจำสาขา
   * เพิ่มการป้องกันข้อผิดพลาดกรณีดักจับค่าสตริงสถานะประเภท CSV ป้องกันลูปล่มค้างหน้าร้าน 100%
   */
  async getAllPurchaseOrders(req, res, next) {
    try {
      const { branchId } = req.user; // ดึงพิกัดตามสิทธิ์ปลอดภัยจาก Token ส่วนกลาง
      const { status } = req.query;  // รองรับฟิลเตอร์สถานะจากหน้าจอ POS

      // 🟢 [DEFENSIVE PARAMETER NORMALIZATION] ปรับแต่งฟอร์แมตสตริงให้เคลียร์ สะอาด ก่อนส่งเข้า Layer Service เพื่อกัน Prisma ระเบิด
      let cleanStatus = 'all';
      if (status && typeof status === 'string' && status.trim() !== '') {
        cleanStatus = status.trim();
      }

      // เรียกดึงข้อมูลประวัติจัดซื้อจริงผ่าน Layer Service ของโครงสร้าง v2
      const list = await purchaseOrderService.getAllPurchaseOrders(branchId, cleanStatus);

      // 🟢 [PREMIUM FINANCIAL SHAPING] แปลงโครงสร้างข้อมูลให้แน่ใจว่าค่าตัวเลข Decimal/BigInt ส่งกลับไป FE เป็นตัวเลขที่คำนวณได้เสมอ
      const normalizedList = Array.isArray(list) ? list.map(po => ({
        id: po.id,
        code: po.code || po.poNumber || '-', // รองรับทั้ง Schema ตัวเลขรหัส code และ poNumber
        status: po.status || 'PENDING',
        totalAmount: po.totalAmount ? Number(po.totalAmount) : 0, // บังคับหล่อหลอม Type ป้องกันค่าเงินแบนราบเป็นศูนย์
        createdAt: po.createdAt,
        supplierId: po.supplierId,
        supplier: po.supplier ? { name: po.supplier.name } : { name: 'ไม่ระบุคู่ค้า' },
        employee: po.employee ? { name: po.employee.name } : { name: '-' }
      })) : [];

      return res.status(200).json({
        success: true,
        data: normalizedList
      });
    } catch (error) {
      console.error('❌ [BE Influx Emergency Error]:', error);
      next(error);
    }
  }

  /**
   * ลงทะเบียนผู้จัดจำหน่ายคู่ค้ารายใหม่ประจำพิกัดสาขา
   */
  async createSupplier(req, res, next) {
    try {
      const { branchId } = req.user;
      const payload = req.body;

      const supplier = await supplierService.createSupplier(branchId, payload);

      return res.status(201).json({
        success: true,
        message: 'ทำรายการลงทะเบียนคู่ค้าผู้จัดส่งสินค้าใหม่สำเร็จ',
        data: supplier
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ตรวจสอบวงเงินเครดิตคงเหลือคงคลัง
   */
  async checkCreditLimit(req, res, next) {
    try {
      const { branchId } = req.user;
      const { supplierId } = req.params;

      const supplier = await supplierService.getSupplierById(supplierId, branchId);

      return res.status(200).json({
        success: true,
        data: {
          supplierId: supplier.id,
          name: supplier.name,
          creditBalance: supplier.creditBalance ?? 0
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * สร้างใบจัดสั่งซื้อ (Create PO)
   */
  async createPO(req, res, next) {
    try {
      const { id: employeeId, branchId } = req.user;
      const payload = req.body;

      const purchaseOrder = await purchaseOrderService.createPurchaseOrder(employeeId, branchId, payload);

      return res.status(201).json({
        success: true,
        message: 'ทำรายการสร้างใบจองจัดซื้อระบบควบคุมความปลอดภัยเครดิต v2 สำเร็จ',
        data: purchaseOrder
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ตรวจรับผลิตภัณฑ์เข้าสต็อกคลัง (Receive PO)
   */
  async receivePO(req, res, next) {
    try {
      const { id: employeeId, branchId, businessType } = req.user;
      const { poId } = req.params;
      const payload = req.body;

      const result = await purchaseOrderService.receivePurchaseOrder(
        employeeId,
        branchId,
        poId,
        payload,
        businessType
      );

      return res.status(201).json({
        success: true,
        message: 'กระบวนการตรวจรับของเข้าพิกัดคลัง บันทึกยอดสะสมภาษี และบันทึก AP เจ้าหนี้การค้าสำเร็จ',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * จ่ายชำระลดหนี้สะสมคู่จัดส่ง ( AP Debt Settlement )
   */
  async settleDebt(req, res, next) {
    try {
      const { branchId } = req.user;
      const { supplierId } = req.params;
      const { amount } = req.body;

      const result = await purchaseOrderService.paySupplierDebt(branchId, supplierId, amount);

      return res.status(200).json({
        success: true,
        message: 'กระบวนการชำระเงินปรับลดยอดหนี้สินสะสมของผู้ส่งมอบของเสร็จสมบูรณ์แล้ว',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ดึงรายการเอกสารใบรับสินค้าที่รอตรวจจัดพิมพ์บาร์โค้ด
   */
  async getReceiptsForBarcode(req, res, next) {
    try {
      const { branchId } = req.user;
      const { mode } = req.query;

      const list = await purchaseOrderService.getReceiptsForBarcode(branchId, mode || 'pending');

      return res.status(200).json({
        success: true,
        data: list
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ดึงพรีวิวพิกัดป้ายบาร์โค้ด/ซีเรียลนัมเบอร์ของผลิตภัณฑ์ประจำใบรับนั้นๆ
   */
  async getBarcodePreview(req, res, next) {
    try {
      const { branchId, businessType } = req.user;
      const { receiptId } = req.params;

      const preview = await purchaseOrderService.getReceiptBarcodePreview(branchId, receiptId, businessType);

      return res.status(200).json({
        success: true,
        data: preview
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ยืนยันเปลี่ยนแฟล็ก printed บันทึกเปลี่ยนตัวกรองแท็บของหน้าจอ POS บาร์โค้ด
   */
  async confirmBarcodePrinted(req, res, next) {
    try {
      const { branchId } = req.user;
      const { receiptId } = req.params;

      const result = await purchaseOrderService.confirmBarcodePrinted(branchId, receiptId);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * เรียกข้อมูลเอกสารตรวจรับสินค้าที่ค้างยิงสแกนซีเรียลเฉพาะตัวของไอที (Pending Scan)
   */
  async getPendingScanReceipts(req, res, next) {
    try {
      const { branchId } = req.user;
      const list = await purchaseOrderService.getPendingScanReceipts(branchId);

      return res.status(200).json({
        success: true,
        data: list
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * คอนโทรลเลอร์รับสแกนและบันทึกหมายเลขซีเรียลเฉพาะเครื่องสลักสถานะ IN_STOCK
   */
  async scanSerialItem(req, res, next) {
    try {
      const { branchId } = req.user;
      const { receiptId } = req.params;
      const payload = req.body;

      const stockItem = await purchaseOrderService.registerScannedSerial(branchId, receiptId, payload);

      return res.status(201).json({
        success: true,
        message: 'ยิงสแกนและบันทึกรหัสซีเรียลเครื่องเข้าคลังสำเร็จ',
        data: stockItem
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ปุ่มจุดระเบิดเพื่อปิดล็อตยอดคลัง บังคับปิดบิลใบ PO และเคลียร์หนี้การค้าระหว่างกัน
   */
  async finalizeReceipt(req, res, next) {
    try {
      const { id: employeeId, branchId } = req.user;
      const { receiptId } = req.params;

      const result = await purchaseOrderService.finalizeReceipt(employeeId, branchId, receiptId);

      return res.status(200).json({
        success: true,
        message: 'ปิดงบบันทึกยอดล็อตสต็อก และตรวจคืนสัดส่วนสมดุลเงินเครดิตจัดจัดซื้อสำเร็จ',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProcurementController();