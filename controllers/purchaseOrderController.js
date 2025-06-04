// controllers/purchaseOrderController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ✅ ฟังก์ชัน gen code สำหรับใบสั่งซื้อ
const generatePurchaseOrderCode = async (branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0'); // ✅ เพิ่มเลข 0 นำหน้า branchId
  const now = new Date();
  const yymm = `${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const count = await prisma.purchaseOrder.count({
    where: {
      branchId,
      createdAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    },
  });
  const sequence = `${(count + 1).toString().padStart(4, '0')}`;
  return `PO-${paddedBranch}${yymm}-${sequence}`;
};

// ✅ PATCH: อัปเดตสถานะใบสั่งซื้อ (เช่น เป็น COMPLETED)
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

// ✅ GET: All purchase orders (with optional filters)
const getAllPurchaseOrders = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    const { search = '', status = 'all' } = req.query;

    console.log('📤 getPurchaseOrders params:', { search, status, branchId });

    if (!branchId) {
      return res.status(401).json({ error: 'Unauthorized: Missing branchId' });
    }

    const where = {
      branchId,
      ...(status !== 'all' && { status: status.toUpperCase() }),
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
            product: {
              select: {                
                title: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(purchaseOrders);
  } catch (err) {
    console.error('❌ getAllPurchaseOrders error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ✅ GET: Purchase orders that are still open for receiving
const getEligiblePurchaseOrders = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    if (!branchId) {
      return res.status(401).json({ error: 'Unauthorized: Missing branchId' });
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        branchId,
        status: {
          in: ['PENDING', 'PARTIAL']
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

// ✅ GET: Single purchase order by ID
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
              select: {
                id: true,
                title: true
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

// ✅ POST: Create purchase order
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
            price: item.unitPrice || 0
          }))
        }
      }
    });

    res.status(201).json(newPO);
  } catch (err) {
    console.error('❌ createPurchaseOrder error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ✅ PUT: Update purchase order
const updatePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, status, items } = req.body;

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
              price: item.price || 0,
            })),
          },
        },
      });
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

    // ตรวจสอบก่อนว่า PO นี้อยู่ใน branch ของผู้ใช้หรือไม่
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


module.exports = {
  getAllPurchaseOrders,
  getEligiblePurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  generatePurchaseOrderCode,
  updatePurchaseOrderStatus
};
