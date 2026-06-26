// src/modules/procurement/services/purchaseOrderService.js
const prisma = require('../../../database/prisma/client');
const AppError = require('../../../shared/errors/AppError');
const supplierService = require('./supplierService');

class PurchaseOrderService {
  /**
   * 🟢 [MIGRATION ADDITION] ดึงรายการใบสั่งจัดซื้อ (PurchaseOrder) ทั้งหมดประจำสาขา
   * ดึงข้อมูลตรงล็อกตามตารางหลัก v2 ไม่หลงทางไปหยิบใบตรวจรับของ (RC)
   */
  async getAllPurchaseOrders(branchId, filterStatus) {
    const statuses = filterStatus && filterStatus !== 'all' 
      ? filterStatus.split(',').map(s => s.trim().toUpperCase())
      : [];

    return await prisma.purchaseOrder.findMany({
      where: {
        branchId,
        ...(statuses.length ? { status: { in: statuses } } : {})
      },
      include: {
        supplier: {
          select: { name: true }
        },
        employee: {
          select: { name: true } // ดึงชื่อพนักงานผู้สร้างบิล PO ตามกติกาโมเดล v2
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * 1. ตรรกะจัดทำเอกสารใบสั่งซื้อสินค้า และหักลดเครดิตบาลานซ์คู่ค้าภายใต้ระบบ $transaction
   */
  async createPurchaseOrder(employeeId, branchId, payload) {
    const { supplierId, items } = payload;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('กรุณาระบุรายละเอียดรายการผลิตภัณฑ์ในใบสั่งจัดซื้อให้ครบถ้วน', 400);
    }

    let totalAmount = 0;
    const parsedItems = items.map(item => {
      if (!item.productId || !item.quantity || item.quantity <= 0 || !item.costPrice || item.costPrice < 0) {
        throw new AppError('พารามิเตอร์ข้อมูลผลิตภัณฑ์ในรายการสั่งซื้อไม่ถูกต้อง (กรุณาตรวจทานจำนวนหรือราคา)', 400);
      }
      totalAmount += item.quantity * item.costPrice;
      return {
        productId: item.productId,
        quantity: parseInt(item.quantity, 10),
        costPrice: parseFloat(item.costPrice)
      };
    });

    return await prisma.$transaction(async (tx) => {
      // ดักประมวลผลหักวงเงินสะสมเครดิตซัพพลายเออร์ก่อนสร้างเอกสาร
      await supplierService.deductSupplierCredit(supplierId, totalAmount, tx);

      // รัน Running Code เลขที่ใบส่งซื้ออัตโนมัติ: PO-สาขา-ปีเดือนวัน-ลำดับรหัส (พิกัด 2026)
      const today = new Date();
      const year = today.getFullYear(); // 2026
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;

      const branchCode = branchId.slice(0, 4).toUpperCase();
      const prefix = `PO-${branchCode}-${dateStr}-`;

      const lastPo = await tx.purchaseOrder.findFirst({
        where: { code: { startsWith: prefix }, branchId },
        orderBy: { code: 'desc' },
        select: { code: true }
      });

      let nextSequence = 1;
      if (lastPo && lastPo.code) {
        const parts = lastPo.code.split('-');
        const lastSeqStr = parts[parts.length - 1];
        const lastSeqNum = parseInt(lastSeqStr, 10);
        if (!isNaN(lastSeqNum)) {
          nextSequence = lastSeqNum + 1;
        }
      }

      const sequenceString = String(nextSequence).padStart(3, '0');
      const poCode = `${prefix}${sequenceString}`;

      return await tx.purchaseOrder.create({
        data: {
          code: poCode,
          branchId,
          supplierId,
          employeeId,
          status: 'PENDING', // ตั้งค่าเป็นสถานะรอดำเนินการเสมอ
          totalAmount,
          items: {
            create: parsedItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              costPrice: item.costPrice
            }))
          }
        },
        include: {
          items: { include: { product: true } },
          supplier: true
        }
      });
    });
  }

  /**
   * 2. ตรรกะตรวจรับพัสดุและตั้งภาษีคู่ค้า แยกโหมดสต็อกผสม (Hybrid Influx) และอัปเดตยอดรับสะสม
   */
  async receivePurchaseOrder(employeeId, branchId, poId, payload, businessType) {
    const { supplierTaxInvoiceNumber, supplierTaxInvoiceDate, receivedAt, note, items } = payload;
    const isStructured = businessType === 'IT' || businessType === 'ELECTRONICS';

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('กรุณาระบุรายละเอียดรายการผลิตภัณฑ์สินค้าที่มีการส่งมอบจริงในเอกสารตรวจรับ', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id: poId, branchId },
        include: { items: true }
      });

      if (!po || po.status === 'COMPLETED') {
        throw new AppError('ไม่พบเอกสารจัดสั่งซื้อ หรือเอกสารนี้ได้รับการส่งมอบตรวจรับเสร็จสิ้นแล้ว', 400);
      }

      // ออกรหัสตรวจรับสะสมอัตโนมัติ: RC-สาขา-ปีเดือนวัน-ลำดับ
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;

      const branchCode = branchId.slice(0, 4).toUpperCase();
      const rcPrefix = `RC-${branchCode}-${dateStr}-`;

      const lastReceipt = await tx.purchaseOrderReceipt.findFirst({
        where: { code: { startsWith: rcPrefix }, branchId },
        orderBy: { code: 'desc' },
        select: { code: true }
      });

      let nextRcSeq = 1;
      if (lastReceipt && lastReceipt.code) {
        const parts = lastReceipt.code.split('-');
        const lastSeqStr = parts[parts.length - 1];
        const lastSeqNum = parseInt(lastSeqStr, 10);
        if (!isNaN(lastSeqNum)) {
          nextRcSeq = lastSeqNum + 1;
        }
      }

      const rcSequenceString = String(nextRcSeq).padStart(3, '0');
      const rcCode = `${rcPrefix}${rcSequenceString}`;

      // หากเป็นธุรกิจประเภทไอที ให้ตั้งค่าเริ่มต้นเป็น PENDING_SCAN เพื่อจำกัดให้พนักงานหลังบ้านไปทำเรื่องยิงซีเรียลตรรกะรายชิ้น
      const initialStatus = isStructured ? 'PENDING_SCAN' : 'COMPLETED';

      // บันทึกหัวเอกสารใบตรวจรับใบเสร็จภาษีพัสดุ
      const receipt = await tx.purchaseOrderReceipt.create({
        data: {
          code: rcCode,
          supplierTaxInvoiceNumber,
          supplierTaxInvoiceDate: supplierTaxInvoiceDate ? new Date(supplierTaxInvoiceDate) : null,
          receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
          note,
          printed: false, // บันทึกตั้งค่าสถานะเริ่มต้นการพิมพ์ป้ายบาร์โค้ด
          statusReceipt: initialStatus,
          purchaseOrderId: poId,
          receivedById: employeeId, // เกาะคีย์ตัวแปรตาม schema จริง
          branchId
        }
      });

      let actualReceiptTotalValue = 0;

      // ประมวลผลและแยกแยะสต็อกตามประเภทสินค้า
      for (const item of items) {
        const poItem = po.items.find(pi => pi.productId === item.productId);
        if (!poItem) {
          throw new AppError(`รายการผลิตภัณฑ์รหัส ${item.productId} ไม่สอดคล้องกับรายละเอียดในใบสั่งจัดสั่งซื้อเดิม`, 400);
        }

        const currentReceived = poItem.receivedQuantity || 0;
        const targetReceived = currentReceived + item.quantity;

        if (targetReceived > poItem.quantity) {
          throw new AppError(`จำนวนยอดตรวจรับสินค้าเกินขอบข่ายขีดจำกัดสั่งซื้อจริง (รหัสสินค้า: ${item.productId})`, 400);
        }

        // ก. บันทึกข้อมูลรายการลูกตรวจรับพัสดุ PurchaseOrderReceiptItem
        await tx.purchaseOrderReceiptItem.create({
          data: {
            purchaseOrderReceiptId: receipt.id,
            productId: item.productId,
            quantity: item.quantity,
            costPrice: poItem.costPrice
          }
        });

        // ข. อัปเดตปรับปรุงจำนวนยอดรับสะสม receivedQuantity ในตารางย่อยดั้งเดิม
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: {
            receivedQuantity: targetReceived
          }
        });

        actualReceiptTotalValue += item.quantity * poItem.costPrice;

        // ค. ตรรกะแยกพฤติกรรมนำสินค้าเข้าสต็อกตามความต้องการของระบบฐานข้อมูลตัวจริงอย่างเคร่งครัด
        if (isStructured) {
          // โหมดคุมซีเรียลรายชิ้น (STRUCTURED)
          if (item.serialNumbers && item.serialNumbers.length === item.quantity) {
            for (const serial of item.serialNumbers) {
              await tx.stockItem.create({
                data: {
                  productId: item.productId,
                  branchId,
                  serialNumber: serial,
                  status: 'IN_STOCK',
                  purchaseOrderReceiptItemId: receipt.id
                }
              });
            }
          } else if (item.quantity > 0) {
            throw new AppError(`สินค้าประเภทซีเรียลนัมเบอร์รหัส ${item.productId} จำเป็นต้องระบุข้อมูลรหัสซีเรียลเครื่องครบถ้วนตามสัดส่วนที่นำเข้า`, 400);
          }
        } else {
          // โหมดคลังของชำสะสมยอดรวม (SIMPLE):
          const lotNumber = `LOT-${branchCode}-${dateStr}-${String(item.productId)}`;

          await tx.simpleLot.create({
            data: {
              productId: item.productId,
              branchId,
              barcode: lotNumber, // ใช้ barcode เป็น unique key ตามโครงสร้าง schema
              qtyInitial: item.quantity,      
              qtyRemaining: item.quantity,    
              unitCost: poItem.costPrice,     
              status: 'ACTIVE'
            }
          });

          await tx.stockBalance.upsert({
            where: { branchId_productId: { branchId, productId: item.productId } },
            update: {
              quantity: { increment: item.quantity } 
            },
            create: {
              branchId,
              productId: item.productId,
              quantity: item.quantity,
              reserved: 0
            }
          });
        }
      }

      // ดำเนินการล็อกปิดบิลใบ PO แม่
      if (!isStructured) {
        const updatedPo = await tx.purchaseOrder.findUnique({
          where: { id: poId },
          include: { items: true }
        });

        const isPoFullyReceived = updatedPo.items.every(pi => pi.receivedQuantity >= pi.quantity);
        if (isPoFullyReceived) {
          await tx.purchaseOrder.update({
            where: { id: poId },
            data: { status: 'COMPLETED' }
          });
        }

        const initialTotalAmount = po.totalAmount || 0;
        const creditToRefund = initialTotalAmount - actualReceiptTotalValue;
        if (creditToRefund > 0 && isPoFullyReceived) {
          await supplierService.refundSupplierCredit(po.supplierId, creditToRefund, tx);
        }
      }

      // ดับเพิ่มยอดหนี้สินการค้าระหว่างกันบนตารางของคู่ค้าผู้ส่งสินค้า
      await tx.supplier.update({
        where: { id: po.supplierId },
        data: {
          creditBalance: { increment: actualReceiptTotalValue } // เกาะตามโครงสร้างเครดิตโมเดลฐานข้อมูล v2
        }
      });

      return receipt;
    });
  }

  /**
   * 3. ตรรกะลดยอดหนี้สินค้างชำระสะสมของผู้จัดจำหน่าย
   */
  async paySupplierDebt(branchId, supplierId, amount) {
    if (amount <= 0) {
      throw new AppError('จำนวนยอดวงเงินชำระหนี้ จำเป็นต้องมีมูลค่ามากกว่าศูนย์', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: supplierId, branchId }
      });

      if (!supplier) {
        throw new AppError('ไม่พบข้อมูลประวัติคู่จัดจำหน่ายรายนี้ในระบบสารบบของสาขา', 404);
      }

      return await tx.supplier.update({
        where: { id: supplierId },
        data: {
          creditBalance: { decrement: amount }
        }
      });
    });
  }

  /**
   * 4. ดึงรายการเอกสารใบรับพัสดุ [FIXED FOR PRISMA INTEGRITY]
   */
  async getReceiptsForBarcode(branchId, filterMode) {
    const isPrinted = filterMode === 'printed';

    return await prisma.purchaseOrderReceipt.findMany({
      where: {
        branchId,
        printed: isPrinted 
      },
      include: {
        purchaseOrder: { select: { code: true } },
        receivedBy: { select: { name: true } } 
      },
      orderBy: { receivedAt: 'desc' }
    });
  }

  /**
   * 5. ดึงข้อมูลพรีวิวป้ายพิมพ์บาร์โค้ดของผลิตภัณฑ์ประจำใบรับนั้นๆ
   */
  async getReceiptBarcodePreview(branchId, receiptId, businessType) {
    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    if (!receipt) {
      throw new AppError('ไม่พบเอกสารใบรับพัสดุสินค้าที่ต้องการประมวลจัดทำพรีวิวบาร์โค้ด', 404);
    }

    const isStructured = businessType === 'IT' || businessType === 'ELECTRONICS';
    const barcodeLabels = [];

    for (const item of receipt.items) {
      if (isStructured) {
        const stockItems = await prisma.stockItem.findMany({
          where: {
            productId: item.productId,
            branchId,
            purchaseOrderReceiptItemId: receiptId
          },
          orderBy: { createdAt: 'desc' }
        });

        stockItems.forEach(si => {
          barcodeLabels.push({
            productId: item.productId,
            productName: item.product.name,
            barcode: si.serialNumber, 
            isSerial: true
          });
        });
      } else {
        for (let i = 0; i < item.quantity; i++) {
          barcodeLabels.push({
            productId: item.productId,
            productName: item.product.name,
            barcode: 'NO_BARCODE',
            isSerial: false
          });
        }
      }
    }

    return {
      receiptId: receipt.id,
      receiptCode: receipt.code,
      totalLabels: barcodeLabels.length,
      labels: barcodeLabels
    };
  }

  /**
   * 6. บันทึกยืนยันเปลี่ยนแฟล็ก printed บนตาราง PurchaseOrderReceipt เป็น true
   */
  async confirmBarcodePrinted(branchId, receiptId) {
    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId }
    });

    if (!receipt) {
      throw new AppError('ไม่พบเอกสารใบรับพัสดุที่ต้องการยืนยันล็อกสถานะป้ายพิมพ์บาร์โค้ด', 404);
    }

    return await prisma.purchaseOrderReceipt.update({
      where: { id: receiptId },
      data: {
        printed: true 
      }
    });
  }

  /**
   * 7. ดึงรายการเอกสารตรวจรับสินค้าที่ค้างยิงสแกนบาร์โค้ดประจำสาขา
   */
  async getPendingScanReceipts(branchId) {
    return await prisma.purchaseOrderReceipt.findMany({
      where: {
        branchId,
        statusReceipt: 'PENDING_SCAN' 
      },
      include: {
        purchaseOrder: { select: { code: true } },
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * 8. รับและลงทะเบียน Serial Number รายชิ้นสลักความปลอดภัย 'IN_STOCK' เข้าตาราง StockItem
   */
  async registerScannedSerial(branchId, receiptId, payload) {
    const { productId, serialNumber } = payload;

    if (!productId || !serialNumber) {
      throw new AppError('กรุณาระบุรหัสผลิตภัณฑ์และหมายเลขซีเรียลนัมเบอร์ของตัวเครื่องสำหรับการสแกน', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseOrderReceipt.findFirst({
        where: { id: receiptId, branchId, statusReceipt: 'PENDING_SCAN' },
        include: { items: true }
      });

      if (!receipt) {
        throw new AppError('ไม่พบเอกสารใบตรวจรับของในสถานะรอสแกนพิกัดรหัสในระบบสาขาของท่าน', 404);
      }

      const receiptItem = receipt.items.find(i => i.productId === productId);
      if (!receiptItem) {
        throw new AppError('ผลิตภัณฑ์สินค้ารหัสนี้ไม่สอดคล้องกับรายการตรวจรับพัสดุย่อยฉบับนี้', 400);
      }

      const existingItem = await tx.stockItem.findUnique({
        where: { serialNumber }
      });

      if (existingItem) {
        throw new AppError(`รหัสซีเรียลเครื่อง '${serialNumber}' ได้รับการลงทะเบียนในฐานคลังอื่นเรียบร้อยแล้ว ห้ามยิงซ้ำ`, 400);
      }

      const currentScannedCount = await tx.stockItem.count({
        where: { productId, branchId, purchaseOrderReceiptItemId: receiptId }
      });

      if (currentScannedCount >= receiptItem.quantity) {
        throw new AppError('ยอดสแกนป้อนบันทึกรหัสซีเรียลเฉพาะเครื่องเต็มสัดส่วนปริมาณนำเข้าแล้ว', 400);
      }

      return await tx.stockItem.create({
        data: {
          productId,
          branchId,
          serialNumber,
          status: 'IN_STOCK', 
          purchaseOrderReceiptItemId: receiptId
        }
      });
    });
  }

  /**
   * 9. บันทึกยืนยันจุดระเบิดล็อกเอกสาร ปิดยอดสะสมใบ PO และเคลียร์สมดุลยอดเครดิตคู่จัดจำหน่าย
   */
  async finalizeReceipt(employeeId, branchId, receiptId) {
    return await prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseOrderReceipt.findFirst({
        where: { id: receiptId, branchId, statusReceipt: 'PENDING_SCAN' },
        include: { items: { include: { product: true } } }
      });

      if (!receipt) {
        throw new AppError('ไม่พบข้อมูลเอกสารใบตรวจรับของในสถานะรอดำเนินปิดยอดสะสมของสาขา', 404);
      }

      for (const item of receipt.items) {
        const scannedCount = await tx.stockItem.count({
          where: { productId: item.productId, branchId, purchaseOrderReceiptItemId: receiptId }
        });

        if (scannedCount !== item.quantity) {
          throw new AppError(
            `ไม่สามารถบันทึกปิดล็อตได้เนื่องจากมียอดค้างสแกนซีเรียล (สินค้า: ${item.product.name}, ยอดบันทึก: ${scannedCount}/${item.quantity})`,
            400
          );
        }
      }

      const finalizedReceipt = await tx.purchaseOrderReceipt.update({
        where: { id: receiptId },
        data: { statusReceipt: 'COMPLETED' }
      });

      const po = await tx.purchaseOrder.findUnique({
        where: { id: receipt.purchaseOrderId },
        include: { items: true }
      });

      const isPoFullyReceived = po.items.every(pi => pi.receivedQuantity >= pi.quantity);
      if (isPoFullyReceived) {
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: 'COMPLETED' }
        });
      }

      let actualReceivedValue = 0;
      receipt.items.forEach(item => {
        actualReceivedValue += item.quantity * item.costPrice;
      });

      const initialTotalPoAmount = po.totalAmount || 0;
      const creditDifference = initialTotalPoAmount - actualReceivedValue;
      if (creditDifference > 0 && isPoFullyReceived) {
        await supplierService.refundSupplierCredit(po.supplierId, creditDifference, tx);
      }

      return {
        finalizedReceipt,
        refundedCredit: creditDifference > 0 && isPoFullyReceived ? creditDifference : 0
      };
    });
  }
}

module.exports = new PurchaseOrderService();