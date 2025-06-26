const dayjs = require('dayjs');
const { PrismaClient,ReceiptStatus  } = require('@prisma/client');
const prisma = new PrismaClient();

const generateReceiptCode = async (branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
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

const createPurchaseOrderReceipt = async (req, res) => {
  try {
    const { purchaseOrderId, note } = req.body;
    const branchId = req.user.branchId;
    const receivedById = req.user.employeeId;
    if (!purchaseOrderId) {
      return res.status(400).json({ error: 'กรุณาระบุใบสั่งซื้อ' });
    }

    const code = await generateReceiptCode(branchId);

    const created = await prisma.purchaseOrderReceipt.create({
      data: {
        note,
        receivedById,
        code,
        branch: { connect: { id: branchId } },
        purchaseOrder: { connect: { id: purchaseOrderId } },
      },
      include: {
        purchaseOrder: {
          select: {
            code: true,
            supplier: { select: { name: true } },
            items: true,
          },
        },
      },
    });

    // ✅ Update costPrice จากใบส่งของ (กรณีราคาสินค้ามีการเปลี่ยน)
    for (const item of created.purchaseOrder.items) {
      await prisma.branchPrice.upsert({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId,
          },
        },
        update: {
          costPrice: item.costPrice,
        },
        create: {
          productId: item.productId,
          branchId,
          costPrice: item.costPrice,
        },
      });
    }

    res.status(201).json(created);
  } catch (error) {
    console.error('❌ [createPurchaseOrderReceipt] error:', error);
    res.status(500).json({ error: 'สร้างใบรับสินค้าไม่สำเร็จ' });
  }
};


const getAllPurchaseOrderReceipts = async (req, res) => {
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

const getPurchaseOrderReceiptById = async (req, res) => {
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
              select: { product: { select: { name: true } } },
            },
          },
        },
        purchaseOrder: {
          select: {
            code: true,
            supplier: {
              select: {
                id: true,
                name: true,
                creditLimit: true,
                creditBalance: true,
              },
            },
            id: true,
          },
        },
      },
    });

    if (!receipt) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้' });

    const paymentLinks = await prisma.supplierPaymentPO.findMany({
      where: { purchaseOrderId: receipt.purchaseOrder.id },
      select: { amountPaid: true },
    });

    const totalPaid = paymentLinks.reduce((sum, p) => sum + p.amountPaid, 0);

    const response = {
      ...receipt,
      purchaseOrder: {
        ...receipt.purchaseOrder,
        supplier: {
          ...receipt.purchaseOrder.supplier,
          debitAmount: totalPaid,
        },
      },
    };

    res.set('Cache-Control', 'no-store');
    res.json(response);
  } catch (error) {
    console.error('❌ [getPurchaseOrderReceiptById] error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงใบรับสินค้าได้' });
  }
};

const getPurchaseOrderDetailById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = req.user.branchId;

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
      return { ...item, receivedQuantity };
    });

    res.json({ ...purchaseOrder, items: itemsWithReceived });
  } catch (error) {
    console.error('❌ [getPurchaseOrderDetailById] error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลใบสั่งซื้อได้' });
  }
};

const markReceiptAsCompleted = async (req, res) => {
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

const updatePurchaseOrderReceipt = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = req.user.branchId;

    const found = await prisma.purchaseOrderReceipt.findFirst({ where: { id, branchId } });
    if (!found) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้' });

    const updated = await prisma.purchaseOrderReceipt.update({
      where: { id },
      data: { note: req.body.note },
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

const deletePurchaseOrderReceipt = async (req, res) => {
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

const getReceiptBarcodeSummaries = async (req, res) => {
  try {
    const branchId = req.user.branchId;

    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: { branchId },
      select: {
        id: true,
        code: true,
        receivedAt: true,
        status: true, // ✅ เพิ่มฟิลด์สถานะ
        items: {
          include: {
            stockItems: true,
            purchaseOrderItem: {
              select: { product: { select: { name: true } } },
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
        status: receipt.status, // ✅ ส่ง status ไป frontend
      };
    });

    res.set('Cache-Control', 'no-store');
    res.json(summaries);
  } catch (error) {
    console.error('❌ [getReceiptBarcodeSummaries] error:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลใบรับสินค้าสำหรับพิมพ์บาร์โค้ดได้' });
  }
};

const finalizePurchaseOrderReceiptIfNeeded = async (receiptId) => {
  const receipt = await prisma.purchaseOrderReceipt.findUnique({
    where: { id: receiptId },
    include: {
      items: {
        include: {
          stockItems: true,
          purchaseOrderItem: true,
        },
      },
    },
  });

  if (!receipt) return;

  const totalQuantity = receipt.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalSN = receipt.items.reduce((sum, item) => sum + item.stockItems.length, 0);

  if (totalSN < totalQuantity) return;

  await prisma.purchaseOrderReceipt.update({
    where: { id: receiptId },
    data: { status: 'COMPLETED' },
  });
};

const finalizeReceiptController = async (req, res) => {
  try {
    const { id } = req.params;
    await finalizePurchaseOrderReceiptIfNeeded(Number(id));
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ finalizeReceiptController error:', err);
    res.status(500).json({ success: false, error: 'Failed to finalize receipt.' });
  }
};

const markPurchaseOrderReceiptAsPrinted = async (req, res) => {
  try {
    console.log('req.params.id : ', req.params.id)
    const id = parseInt(req.params.id);

    const updated = await prisma.purchaseOrderReceipt.update({
      where: { id },
      data: { status: ReceiptStatus.COMPLETED },
    });
    return res.json({ success: true, receipt: updated });
  } catch (error) {
    console.error('❌ markPurchaseOrderReceiptAsPrinted error:', error);
    return res.status(500).json({ error: 'Failed to mark receipt as printed' });
  }
};


module.exports = {
  createPurchaseOrderReceipt,
  getAllPurchaseOrderReceipts,
  getPurchaseOrderReceiptById,
  getPurchaseOrderDetailById,
  markReceiptAsCompleted,
  updatePurchaseOrderReceipt,
  deletePurchaseOrderReceipt,
  getReceiptBarcodeSummaries,
  finalizePurchaseOrderReceiptIfNeeded,
  finalizeReceiptController,
  markPurchaseOrderReceiptAsPrinted,
};
