// controllers/purchaseOrderController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

    const code = `PO-${Date.now()}`;

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

    // อัปเดต PO หลัก
    const updated = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        note,
        status,
      },
    });

    // อัปเดตรายการสินค้า (แบบลบแล้วเพิ่มใหม่ทั้งหมด)
    if (Array.isArray(items)) {
      // ลบของเดิมก่อน
      await prisma.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: poId },
      });

      // เพิ่มรายการใหม่
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


// ✅ DELETE: Delete purchase order
const deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.purchaseOrder.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('❌ deletePurchaseOrder error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder
};
