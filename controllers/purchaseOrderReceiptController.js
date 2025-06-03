  
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 📥 สร้างใบรับสินค้าใหม่
exports.createPurchaseOrderReceipt = async (req, res) => {
  try {
    const { purchaseOrderId, note } = req.body;
    const branchId = req.user.branchId;
    const receivedById = req.user.employeeId;

    const created = await prisma.purchaseOrderReceipt.create({
      data: {
        purchaseOrderId,
        note,
        branchId,
        receivedById,
      },
      include: {
        purchaseOrder: {
          select: {
            code: true,
            supplier: { select: { name: true } },
          },
        },
      },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('❌ [createPurchaseOrderReceipt] error:', error);
    res.status(500).json({ error: 'สร้างใบรับสินค้าไม่สำเร็จ' });
  }
};



// 📄 ดึงรายการใบรับสินค้าทั้งหมด (ตามสาขา)
exports.getAllPurchaseOrderReceipts = async (req, res) => {
  try {
    const branchId = req.user.branchId;

    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: { branchId },
      include: {
        purchaseOrder: {
          select: {
            code: true,
            supplier: { select: { name: true } },
          },
        },
      },
    });

    res.json(receipts);
  } catch (error) {
    console.error('❌ [getAllPurchaseOrderReceipts] error:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดรายการใบรับสินค้าได้' });
  }
};


// 🔍 ดึงใบรับสินค้ารายตัว (พร้อมรายการสินค้าเพื่อสร้าง SN)
exports.getPurchaseOrderReceiptById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = req.user.branchId;

    if (!id) return res.status(400).json({ error: 'Missing or invalid receipt ID' });

    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id, branchId },
      include: {
        items: {
          select: {
            id: true,
            quantity: true,
            purchaseOrderItem: {
              select: {
                product: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        },
        purchaseOrder: {
          select: {
            code: true,
            supplier: { select: { name: true } },
          },
        },
      },
    });

    console.log('🔍 [getPurchaseOrderReceiptById] receipt-------------------------------------------------------- ', receipt);

    if (!receipt) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้' });

    // ✅ ปิด cache สำหรับ dev/debug เพื่อไม่ให้ browser/axios คืน 304
    res.set('Cache-Control', 'no-store');

    res.json(receipt);
  } catch (error) {
    console.error('❌ [getPurchaseOrderReceiptById] error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงใบรับสินค้าได้' });
  }
};





// 📦 ดึงรายละเอียดใบสั่งซื้อ (พร้อม supplier + สินค้า + ยอดรับแล้ว)
exports.getPurchaseOrderDetailById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = req.user.branchId;
    

    console.log('📦 [getPurchaseOrderDetailById] id:>> >> >> >> >>', id, 'branchId:', branchId);

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { id, branchId },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
            receiptItems: true,
          },
        },
      },
    });



    if (!purchaseOrder) return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อนี้' });

    // รวม receivedQuantity เข้าไปในแต่ละ item
    const itemsWithReceived = purchaseOrder.items.map(item => {
      const receivedQuantity = item.receiptItems?.reduce((sum, r) => sum + r.quantity, 0) || 0;
      return {
        ...item,
        receivedQuantity
      };
    });
    
  

    res.json({ ...purchaseOrder, items: itemsWithReceived });
  } catch (error) {
    console.error('❌ [getPurchaseOrderDetailById] error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลใบสั่งซื้อได้' });
  }
};



// ✏️ แก้ไขใบรับสินค้า
exports.updatePurchaseOrderReceipt = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = req.user.branchId;

    const found = await prisma.purchaseOrderReceipt.findFirst({ where: { id, branchId } });
    if (!found) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้' });

    const updated = await prisma.purchaseOrderReceipt.update({
      where: { id },
      data: {
        note,
      },
      include: {
        purchaseOrder: {
          select: {
            code: true,
            supplier: { select: { name: true } },
          },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('❌ [updatePurchaseOrderReceipt] error:', error);
    res.status(500).json({ error: 'ไม่สามารถแก้ไขใบรับสินค้าได้' });
  }
};

// 🗑️ ลบใบรับสินค้า
exports.deletePurchaseOrderReceipt = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = req.user.branchId;

    const found = await prisma.purchaseOrderReceipt.findFirst({ where: { id, branchId } });
    if (!found) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้' });

    await prisma.purchaseOrderReceipt.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [deletePurchaseOrderReceipt] error:', error);
    res.status(500).json({ error: 'ไม่สามารถลบใบรับสินค้าได้' });
  }
};

// 📦 ดึงสรุปใบรับสินค้าพร้อมสถานะบาร์โค้ด (ใช้ในหน้าพิมพ์บาร์โค้ด)
exports.getReceiptBarcodeSummaries = async (req, res) => {
  try {
    const branchId = req.user.branchId;

    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: {
        branchId,
      },
      include: {
        items: {
          include: {
            stockItems: true,
            purchaseOrderItem: {
              select: {
                product: {
                  select: { title: true },
                },
              },
            },
          },
        },
        purchaseOrder: {
          select: {
            code: true,
            supplier: {
              select: { name: true },
            },
          },
        },
      },
    });

    const summaries = receipts.map((receipt) => {
      const total = receipt.items.reduce((sum, item) => sum + item.quantity, 0);
      const generated = receipt.items.reduce((sum, item) => sum + item.stockItems.length, 0);
      return {
        id: receipt.id,
        code: receipt.code,
        receivedAt: receipt.receivedAt,
        supplierName: receipt.purchaseOrder?.supplier?.name || '-',
        orderCode: receipt.purchaseOrder?.code || '-',
        totalItems: total,
        barcodeGenerated: generated,
      };
    });

    res.set('Cache-Control', 'no-store'); // ✅ ปิด cache เพื่อป้องกัน 304
    res.json(summaries);
  } catch (error) {
    console.error('❌ [getReceiptBarcodeSummaries] error:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลใบรับสินค้าสำหรับพิมพ์บาร์โค้ดได้' });
  }
};
