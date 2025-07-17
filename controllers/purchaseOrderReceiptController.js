const dayjs = require('dayjs');
const { PrismaClient,ReceiptStatus  } = require('@prisma/client');
const prisma = new PrismaClient();

const generateReceiptCode = async (branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = dayjs();
  const prefix = `RC-${paddedBranch}${now.format('YYMM')}`;

  const latest = await prisma.purchaseOrderReceipt.findFirst({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    orderBy: {
      code: 'desc',
    },
  });

  let nextNumber = 1;
  if (latest) {
    const lastSequence = parseInt(latest.code.slice(-4), 10); // ✅ ใช้ slice แทน split
    nextNumber = lastSequence + 1;
  }

  const running = String(nextNumber).padStart(4, '0');
  return `${prefix}-${running}`;
};

const createPurchaseOrderReceipt = async (req, res) => {
  try {
    const { purchaseOrderId, note, supplierTaxInvoiceNumber, supplierTaxInvoiceDate } = req.body;
    const branchId = req.user.branchId;
    const receivedById = req.user.employeeId;
    if (!purchaseOrderId) {
      return res.status(400).json({ error: 'กรุณาระบุใบสั่งซื้อ' });
    }

    let created = null;
    let retryCount = 0;
    const maxRetries = 5;

    while (!created && retryCount < maxRetries) {
      const code = await generateReceiptCode(branchId);

      const taxDate = supplierTaxInvoiceDate ? new Date(supplierTaxInvoiceDate) : null;

      try {
        created = await prisma.purchaseOrderReceipt.create({
          data: {
            note,
            receivedById,
            code,
            supplierTaxInvoiceNumber,
            supplierTaxInvoiceDate: taxDate,
            branch: { connect: { id: branchId } },
            purchaseOrder: { connect: { id: parseInt(purchaseOrderId, 10) } },
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
      } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('code')) {
          retryCount++;
          console.warn(`🔁 Duplicate receipt code retrying... (${retryCount})`);
        } else {
          throw err;
        }
      }
    }

    if (!created) {
      return res.status(500).json({ error: 'ไม่สามารถสร้างรหัสใบรับสินค้าแบบไม่ซ้ำได้ กรุณาลองใหม่' });
    }

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
    if (!id) {
      return res.status(400).json({ error: 'Missing or invalid receipt ID' });
    }

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
                  // ✅ CORRECTED: Access 'unit' through the 'template' relation
                  select: {
                    name: true,
                    template: {
                      select: {
                        unit: {
                          select: {
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            code: true,
            supplier: {
              select: {
                id: true,
                name: true,
                creditLimit: true,
                creditBalance: true,
              },
            },
          },
        },
      },
    });

    if (!receipt) {
      return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้' });
    }

    if (!receipt.purchaseOrder || !receipt.purchaseOrder.id) {
      return res.status(400).json({ error: 'ไม่พบข้อมูลใบสั่งซื้อที่เชื่อมโยงกับใบรับนี้' });
    }
    
    // --- CORRECTED LOGIC TO CALCULATE TOTAL PAID FOR THE ENTIRE PO ---

    // 1. ค้นหา ID ของใบรับสินค้า (Receipts) ทั้งหมดที่อยู่ในใบสั่งซื้อ (PO) เดียวกัน
    const allReceiptsForPO = await prisma.purchaseOrderReceipt.findMany({
        where: { purchaseOrderId: receipt.purchaseOrder.id },
        select: { id: true }
    });
    const receiptIds = allReceiptsForPO.map(r => r.id);

    let totalPaid = 0;
    // 2. ถ้ามีใบรับสินค้า, ให้ค้นหาการจ่ายเงินที่เชื่อมโยงกับใบรับเหล่านั้น
    if (receiptIds.length > 0) {
        // ✅ ใช้ชื่อ Model ที่ถูกต้อง: 'supplierPaymentReceipt'
        const paymentLinks = await prisma.supplierPaymentReceipt.findMany({
            where: {
                receiptId: {
                    in: receiptIds,
                },
            },
            select: { amountPaid: true },
        });

        // 3. คำนวณยอดรวมที่จ่ายแล้ว
        totalPaid = paymentLinks.reduce((sum, p) => sum + p.amountPaid, 0);
    }
    
    // We need to re-format the response to be easily usable on the frontend
    const formattedReceipt = {
        ...receipt,
        items: receipt.items.map(item => ({
            id: item.id,
            quantity: item.quantity,
            productName: item.purchaseOrderItem.product.name,
            // Safely access the unit name
            unitName: item.purchaseOrderItem.product.template?.unit?.name || 'N/A',
        })),
    };

    const response = {
      ...formattedReceipt,
      purchaseOrder: {
        ...receipt.purchaseOrder,
        supplier: {
          ...receipt.purchaseOrder.supplier,
          debitAmount: totalPaid, // ✅ ยอดนี้คือยอดที่จ่ายทั้งหมดของ PO ใบนี้
        },
      },
    };

    res.set('Cache-Control', 'no-store');
    res.json(response);
  } catch (error) {
    console.error('❌ [getPurchaseOrderReceiptById] error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด ไม่สามารถดึงข้อมูลใบรับสินค้าได้' });
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
      data: { statusReceipt: 'COMPLETED' },
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
        supplierTaxInvoiceNumber: true,
        statusReceipt: true,
        receivedAt: true,
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
        tax: receipt.supplierTaxInvoiceNumber,
        receivedAt: receipt.receivedAt,
        supplierName: receipt.purchaseOrder?.supplier?.name || '-',
        orderCode: receipt.purchaseOrder?.code || '-',        
        totalItems: total,
        barcodeGenerated: generated,
        status: receipt.statusReceipt, // ✅ ส่ง status ไป frontend
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
      data: { statusReceipt: ReceiptStatus.COMPLETED },
    });
    return res.json({ success: true, receipt: updated });
  } catch (error) {
    console.error('❌ markPurchaseOrderReceiptAsPrinted error:', error);
    return res.status(500).json({ error: 'Failed to mark receipt as printed' });
  }
};

const getReceiptsReadyToPay = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { startDate, endDate, limit } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: {
        branchId,
        statusReceipt: 'COMPLETED',
        statusPayment: {
          not: 'PAID',
        },
        receivedAt: Object.keys(dateFilter).length ? dateFilter : undefined,
      },
      include: {
        items: {
          select: {
            quantity: true,
            costPrice: true,
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            code: true,
            supplier: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                creditLimit: true,
                creditBalance: true,
              },
            },
          },
        },
      },      
      orderBy: { receivedAt: 'asc' },
      take: limit ? parseInt(limit) : undefined,
    });

    const results = receipts
      .map((receipt) => {
        const totalAmount = receipt.items.reduce(
          (sum, item) => sum + item.quantity * item.costPrice,
          0
        );

        const supplier = receipt.purchaseOrder.supplier;
        const paidAmount = receipt.paidAmount || 0; // Renamed from totalPaid to paidAmount
        const remainingAmount = totalAmount - paidAmount; // Use paidAmount here

        return {
          id: receipt.id,
          code: receipt.code,
          orderCode: receipt.purchaseOrder.code,
          supplier,
          totalAmount,
          paidAmount, // Now sending as paidAmount
          remainingAmount,
          receivedDate: receipt.receivedAt,
        };
      })
      .filter((r) => r.remainingAmount > 0); // ✅ Changed filter condition

    return res.json(results);
  } catch (error) {
    console.error('❌ [getReceiptsReadyToPay] error:', error);
    res.status(500).json({ error: 'Failed to load outstanding receipts.' });
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
  getReceiptsReadyToPay,
};
