// controllers/purchaseOrderController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


const generatePurchaseOrderCode = async (branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = new Date();
  const yymm = `${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  const latestPO = await prisma.purchaseOrder.findFirst({
    where: {
      code: {
        startsWith: `PO-${paddedBranch}${yymm}-`
      }
    },
    orderBy: {
      code: 'desc'
    }
  });

  let nextSequence = 1;
  if (latestPO) {
    const lastSequence = parseInt(latestPO.code.slice(-4), 10); // ✅ ปรับให้ปลอดภัย
    nextSequence = lastSequence + 1;
  }

  const sequence = `${nextSequence.toString().padStart(4, '0')}`;
  return `PO-${paddedBranch}${yymm}-${sequence}`;
};


const createPurchaseOrder = async (req, res) => {
  try {
    const { supplierId, items, note } = req.body;
    const branchId = req.user?.branchId;
    const employeeId = req.user?.employeeId;

    if (!branchId) {
      console.warn('⚠️ Missing branchId in token payload');
      return res.status(401).json({ error: 'Unauthorized: Missing branchId' });
    }

    const code = await generatePurchaseOrderCode(branchId);

    const newPO = await prisma.purchaseOrder.create({
      data: {
        code,
        supplier: { connect: { id: supplierId } },
        branch: { connect: { id: branchId } },
        employee: { connect: { id: employeeId } },
        note,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,            
            costPrice: item.costPrice,
          }))
        }
      }
    });

    // ✅ Update or create costPrice in BranchPrice
    for (const item of items) {
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

    res.status(201).json(newPO);
  } catch (err) {
    console.error('❌ createPurchaseOrder error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    res.json({ success: true, updated });
  } catch (err) {
    console.error('❌ updatePurchaseOrderStatus error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getAllPurchaseOrders = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    const { search = '', status = 'all' } = req.query;

    console.log('📤 getPurchaseOrders params:', { search, status, branchId });

    if (!branchId) {
      return res.status(401).json({ error: 'Unauthorized: Missing branchId' });
    }

    const VALID_STATUSES = [
      'PENDING',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'PAID',
      'COMPLETED',
      'CANCELLED',
    ];

    const parsedStatuses = status
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => VALID_STATUSES.includes(s));

    const where = {
      branchId,
      ...(parsedStatuses.length > 0 && status !== 'all' && {
        status: {
          in: parsedStatuses,
        },
      }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { note: { contains: search, mode: 'insensitive' } },
          { supplier: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(purchaseOrders);
  } catch (err) {
    console.error('❌ getAllPurchaseOrders error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getEligiblePurchaseOrders = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    if (!branchId) {
      return res.status(401).json({ error: 'Unauthorized: Missing branchId' });
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        branchId,
        paymentStatus: {
          in: ['UNPAID', 'PARTIALLY_PAID']
        }
      },
      include: {
        supplier: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(purchaseOrders);
  } catch (err) {
    console.error('❌ getEligiblePurchaseOrders error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getPurchaseOrdersBySupplier = async (req, res) => {
  try {

    const rawSupplierId = req.query.supplierId;
    console.log('📥 supplierId query:', rawSupplierId);

    if (!rawSupplierId || isNaN(Number(rawSupplierId))) {
      return res.status(400).json({ error: 'Invalid supplierId' });
    }

    const supplierId = Number(rawSupplierId);
    const branchId = req.user?.branchId;

    if (!branchId) {
      return res.status(401).json({ error: 'Unauthorized: Missing branchId' });
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        supplierId,
        branchId,
        paymentStatus: {
          in: ['PENDING', 'PARTIALLY_RECEIVED'], // ✅ เงื่อนไขใหม่
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
      },
    });

    const result = purchaseOrders.map((po) => ({
      id: po.id,
      code: po.code,
      status: po.status,
      createdAt: po.createdAt,
      totalAmount: po.items.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0),
    }));

    res.json(result);
  } catch (err) {
    console.error('❌ getPurchaseOrdersBySupplier error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getPurchaseOrderById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              include: {
                template: true
              }
            }
          }
        }
      }
    });

    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
    res.json(po);
  } catch (err) {
    console.error('❌ getPurchaseOrderById error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const updatePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, status, items } = req.body;
    const branchId = req.user?.branchId;

    const poId = parseInt(id);

    const updated = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { note, status },
    });

    if (Array.isArray(items)) {
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: poId } });
      await prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              costPrice: item.costPrice,
            })),
          },
        },
      });

      for (const item of items) {
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
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ updatePurchaseOrder error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = req.user?.branchId;

    if (!id || !branchId) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    const found = await prisma.purchaseOrder.findFirst({
      where: {
        id: parseInt(id),
        branchId: branchId,
      },
    });

    if (!found) {
      return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อนี้ในสาขาของคุณ' });
    }

    await prisma.purchaseOrder.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ deletePurchaseOrder error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const createPurchaseOrderWithAdvance = async (req, res) => {
  try {
    const { supplierId, orderDate, note, items, advancePaymentsUsed } = req.body;
    const branchId = req.user.branchId;
    const employeeId = req.user.employeeId;

    let createdPO = null;
    let retryCount = 0;
    const maxRetries = 5;

    while (!createdPO && retryCount < maxRetries) {
      const code = await generatePurchaseOrderCode(branchId);
      try {
        createdPO = await prisma.purchaseOrder.create({
          data: {
            code,
            employeeId,
            supplierId,
            branchId,
            date: new Date(orderDate),
            note,
            status: 'PENDING',
            items: {
              create: items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                costPrice: item.costPrice,
              })),
            },
          },
        });
      } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('code')) {
          retryCount++;
          console.warn(`🔁 Duplicate code retrying... (${retryCount})`);
        } else {
          throw err;
        }
      }
    }

    if (!createdPO) {
      return res.status(500).json({ message: 'ไม่สามารถสร้างรหัส PO ที่ไม่ซ้ำได้ กรุณาลองใหม่' });
    }

    for (const item of items) {
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

    if (advancePaymentsUsed?.length > 0) {
      await prisma.supplierPaymentPO.createMany({
        data: advancePaymentsUsed.map((entry) => ({
          paymentId: entry.paymentId,
          purchaseOrderId: createdPO.id,
          amountPaid: entry.amount || 0,
        })),
      });
    }

    res.status(201).json(createdPO);
  } catch (error) {
    console.error('❌ createPurchaseOrderWithAdvance error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


module.exports = {
  getAllPurchaseOrders,
  getEligiblePurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  generatePurchaseOrderCode,
  updatePurchaseOrderStatus,
  getPurchaseOrdersBySupplier,
  createPurchaseOrderWithAdvance,
};
