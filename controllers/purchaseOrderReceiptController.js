const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');

// 🔧 สร้างเลขที่ใบรับสินค้าอัตโนมัติ
const generateReceiptCode = async (branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0'); // ✅ เพิ่มเลข 0 นำหน้า branchId
  const now = dayjs();
  const prefix = `RC-${paddedBranch}${now.format('YYMM')}`;

  const count = await prisma.purchaseOrderReceipt.count({
    where: {
      branchId,
      createdAt: {
        gte: now.startOf('month').toDate(),
        lt: now.endOf('month').toDate(),
      },
    },
  });

  const running = String(count + 1).padStart(4, '0');
  return `${prefix}-${running}`;
};

// 📥 สร้างใบรับสินค้าใหม่
exports.createPurchaseOrderReceipt = async (req, res) => {
  try {
    const { purchaseOrderId, note } = req.body;
    const branchId = req.user.branchId;
    const receivedById = req.user.employeeId;

    const code = await generateReceiptCode(branchId); // ✅ สร้างเลขใบรับสินค้า

    const created = await prisma.purchaseOrderReceipt.create({
      data: {
        purchaseOrderId,
        note,
        branchId,
        receivedById,
        code,
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

    if (!receipt) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้' });

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

// ✅ อัปเดตสถานะใบรับสินค้าเป็น COMPLETED (เมื่อบันทึกครบ)
exports.markReceiptAsCompleted = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = req.user.branchId;

    const found = await prisma.purchaseOrderReceipt.findFirst({ where: { id, branchId } });
    if (!found) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้' });

    const updated = await prisma.purchaseOrderReceipt.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    res.json(updated);
  } catch (error) {
    console.error('❌ [markReceiptAsCompleted] error:', error);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะใบรับสินค้าได้' });
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
        note: req.body.note,
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

    res.set('Cache-Control', 'no-store');
    res.json(summaries);
  } catch (error) {
    console.error('❌ [getReceiptBarcodeSummaries] error:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลใบรับสินค้าสำหรับพิมพ์บาร์โค้ดได้' });
  }
};
