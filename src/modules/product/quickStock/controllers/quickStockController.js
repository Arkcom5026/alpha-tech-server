// src/modules/product/quickStock/controllers/quickStockController.js
const QuickStockService = require('../services/QuickStockServiceSingleton');

const quickStockService = new QuickStockService();

const getBranchId = (req) => req.employee?.branchId || req.user?.branchId || null;
const getEmployeeId = (req) => req.employee?.id || req.user?.employeeId || null;

const requireBranchContext = (req, res) => {
  const branchId = getBranchId(req);
  if (branchId) return branchId;

  res.status(403).json({
    success: false,
    code: 'BRANCH_CONTEXT_REQUIRED',
    message: 'ไม่พบสาขาของพนักงานผู้ทำรายการ',
  });
  return null;
};

const requireEmployeeContext = (req, res) => {
  const branchId = getBranchId(req);
  const employeeId = getEmployeeId(req);

  if (!branchId) {
    res.status(403).json({
      success: false,
      code: 'BRANCH_CONTEXT_REQUIRED',
      message: 'ไม่พบสาขาของพนักงานผู้ทำรายการ',
    });
    return null;
  }

  if (!employeeId) {
    res.status(403).json({
      success: false,
      code: 'EMPLOYEE_CONTEXT_REQUIRED',
      message: 'ไม่พบข้อมูลพนักงานผู้ทำรายการ',
    });
    return null;
  }

  return { branchId, employeeId };
};

/**
 * ดึงข้อมูลเบื้องต้นสำหรับแสดงผลหน้าจอ QuickStock
 * ล็อกข้อมูลตาม branchId ของพนักงานที่ล็อกอิน
 */
const getQuickStockInitData = async (req, res) => {
  try {
    const branchId = requireBranchContext(req, res);
    if (!branchId) return undefined;

    const products = await quickStockService.getActiveProducts(branchId);
    const productTypes = await quickStockService.getProductTypes(branchId);

    return res.status(200).json({
      success: true,
      data: { products, productTypes },
    });
  } catch (error) {
    console.error('Error in getQuickStockInitData:', error);
    return res.status(500).json({
      success: false,
      message: 'ไม่สามารถดึงข้อมูลพื้นฐานควิกสต๊อกได้',
      error: error.message,
    });
  }
};

/** ดึงข้อมูลรายการสต๊อกปัจจุบันของสาขา */
const getBranchStockItems = async (req, res) => {
  try {
    const branchId = requireBranchContext(req, res);
    if (!branchId) return undefined;

    const stockItems = await quickStockService.getStockByBranch(branchId);
    return res.status(200).json({ success: true, data: stockItems });
  } catch (error) {
    console.error('Error in getBranchStockItems:', error);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสต๊อกสาขา',
      error: error.message,
    });
  }
};

/** API สำหรับลงทะเบียนสแกนรับสินค้าด่วนทีละเม็ดแบบเดิม */
const handleQuickEnroll = async (req, res) => {
  try {
    const { barcode, productId } = req.body;
    const branchId = requireBranchContext(req, res);
    if (!branchId) return undefined;

    if (typeof quickStockService.enrollQuickStock === 'function') {
      const result = await quickStockService.enrollQuickStock({
        barcode,
        productId,
        branchId,
      });

      return res.status(200).json({ success: true, data: result });
    }

    return res.status(200).json({
      success: true,
      message: 'ฟังก์ชันระบบเก่าเปลี่ยนผ่านไปใช้งาน All-in-One เรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Error in handleQuickEnroll:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/** API สำหรับเพิ่มสินค้าเข้าคลังแบบด่วนและครบวงจร */
const quickStockInAllInOne = async (req, res) => {
  try {
    const data = req.body || {};
    const actor = requireEmployeeContext(req, res);
    if (!actor) return undefined;

    if (!data.productName || !data.productTypeId) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่สมบูรณ์: จำเป็นต้องกรอกชื่อสินค้าและประเภทสินค้า',
      });
    }

    if (!data.priceRetail) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่สมบูรณ์: จำเป็นต้องกำหนดราคาขายปลีกประจำสาขา',
      });
    }

    const result = await quickStockService.quickStockInAllInOne(
      data,
      actor.branchId,
      actor.employeeId
    );

    return res.status(200).json({
      success: true,
      message: `ระบบดำเนินการบันทึกข้อมูลสินค้า "${result.productName}" และนำเข้าคลังสต๊อกเรียบร้อยแล้ว`,
      productId: result.productId,
    });
  } catch (error) {
    console.error('Error in quickStockInAllInOne Controller:', error);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดระดับ Server ในการประมวลผลเพิ่มข้อมูลสินค้าเข้าสต๊อกด่วน',
      error: error.message,
    });
  }
};

/**
 * รับสินค้าเข้า Stock Runtime จาก Product เดิม
 * ใช้กับ Recovery / Quick Receive / Manufacture ที่ไม่ผ่าน PO
 */
const quickStockExistingReceive = async (req, res) => {
  try {
    const data = req.body || {};
    const actor = requireEmployeeContext(req, res);
    if (!actor) return undefined;

    if (!data.productId) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่สมบูรณ์: จำเป็นต้องระบุสินค้า',
      });
    }

    if (
      data.costPrice === undefined ||
      data.costPrice === null ||
      Number(data.costPrice) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่สมบูรณ์: จำเป็นต้องกำหนดราคาทุน',
      });
    }

    if (
      data.priceRetail === undefined ||
      data.priceRetail === null ||
      Number(data.priceRetail) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่สมบูรณ์: จำเป็นต้องกำหนดราคาขายปลีก',
      });
    }

    const incomingBarcodes = Array.isArray(data.barcodes)
      ? data.barcodes
      : Array.isArray(data.items)
        ? data.items
        : [];

    if (!incomingBarcodes.length) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่สมบูรณ์: จำเป็นต้องมีรายการบาร์โค้ดอย่างน้อย 1 รายการ',
      });
    }

    for (const row of incomingBarcodes) {
      if (
        Object.prototype.hasOwnProperty.call(row, 'costPrice') ||
        Object.prototype.hasOwnProperty.call(row, 'priceRetail') ||
        Object.prototype.hasOwnProperty.call(row, 'priceWholesale') ||
        Object.prototype.hasOwnProperty.call(row, 'priceTechnician') ||
        Object.prototype.hasOwnProperty.call(row, 'priceOnline')
      ) {
        return res.status(400).json({
          success: false,
          message: 'Runtime Contract ไม่อนุญาตให้ส่งข้อมูลราคาในแต่ละ Queue Item',
        });
      }
    }

    const result = await quickStockService.quickReceiveExistingProduct(
      data,
      actor.branchId,
      actor.employeeId
    );

    return res.status(200).json({
      success: true,
      message: `รับสินค้า ${result.productName} เข้าสต๊อกเรียบร้อย ${result.qty} รายการ`,
      data: result,
    });
  } catch (error) {
    console.error('Error in quickStockExistingReceive Controller:', error);
    const statusCode = error?.statusCode || error?.status || 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการรับสินค้าเข้าสต๊อกจาก Product เดิม',
      code: error.code || 'QUICK_STOCK_EXISTING_RECEIVE_FAILED',
    });
  }
};

module.exports = {
  getQuickStockInitData,
  getBranchStockItems,
  handleQuickEnroll,
  quickStockInAllInOne,
  quickStockExistingReceive,
};
