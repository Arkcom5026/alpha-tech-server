// orderOnlineController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const generateOrderOnlineCode = async (branchId) => {
  const dayjs = require('dayjs');
  const today = dayjs().format('YYMMDD');
  const count = await prisma.orderOnline.count({
    where: {
      branchId,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  });
  const paddedCount = String(count + 1).padStart(3, '0');
  return `ORD${branchId}-${today}-${paddedCount}`;
};

const createOrderOnline = async (req, res) => {
  try {
    const {
      items = [],
      customerId,
      branchId,
      deliveryDate,
      note
    } = req.body;

    const userId = req.user?.id;

    if (!branchId || !Array.isArray(items) || items.length === 0) {
      console.warn('🛑 ข้อมูลไม่ครบ:', {
        branchId,
        items,
      });
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    console.log('📦 createOrderOnline req.body:', req.body);

    const productIds = items.map((item) => item.productId);
    const branchPrices = await prisma.branchPrice.findMany({
      where: {
        branchId,
        productId: { in: productIds },
      },
    });

    const enrichedItems = items.map((item) => {
      const found = branchPrices.find((bp) => bp.productId === item.productId);
      if (!found) {
        console.warn('⚠️ ไม่พบราคาใน branchPrices สำหรับ productId:', item.productId);
      }
      const price = found?.priceOnline || 0;
      return {
        ...item,
        price,
      };
    });

    const calculatedTotal = enrichedItems.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    const code = await generateOrderOnlineCode(branchId);

    const newOrder = await prisma.orderOnline.create({
      data: {
        code,
        customerId: customerId || null,
        branchId,
        deliveryDate: deliveryDate || undefined,
        note: note || '',
        statusPayment: 'UNPAID', // ✅ ใช้ enum PaymentStatus อย่างถูกต้อง
        paymentMethod: 'CASH',
        source: 'ONLINE',
        items: {
          create: enrichedItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            priceAtPurchase: item.price,
            note: item.note || '',
          })),
        },
        userId: userId || null,
      },
    });

    if (userId) {
      await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
      await prisma.cart.deleteMany({ where: { userId } });
    }

    res.status(201).json({ message: 'สร้างคำสั่งซื้อสำเร็จ', order: newOrder });
  } catch (error) {
    console.error('❌ createOrderOnline error:', error);
    console.error('📦 req.body:', req.body);
    res.status(500).json({ error: 'ไม่สามารถสร้างคำสั่งซื้อได้' });
  }
};


const getAllOrderOnline = async (req, res) => {
  try {
    const orders = await prisma.orderOnline.findMany({
      include: {
        customer: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (error) {
    console.error('❌ getAllOrderOnline error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้' });
  }
};

const getOrderOnlineById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.orderOnline.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
    });
    if (!order) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    }
    res.json(order);
  } catch (error) {
    console.error('❌ getOrderOnlineById error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้' });
  }
};

const updateOrderOnlineStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, deliveryDate, note } = req.body;

    const updated = await prisma.orderOnline.update({
      where: { id: Number(id) },
      data: {
        paymentStatus,
        deliveryDate,
        note,
      },
    });

    res.json({ message: 'อัปเดตคำสั่งซื้อสำเร็จ', order: updated });
  } catch (error) {
    console.error('❌ updateOrderOnlineStatus error:', error);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตคำสั่งซื้อได้' });
  }
};

const deleteOrderOnline = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.orderOnline.delete({
      where: { id: Number(id) },
    });
    res.json({ message: 'ลบคำสั่งซื้อสำเร็จ' });
  } catch (error) {
    console.error('❌ deleteOrderOnline error:', error);
    res.status(500).json({ error: 'ไม่สามารถลบคำสั่งซื้อได้' });
  }
};

module.exports = {
  createOrderOnline,
  getAllOrderOnline,
  getOrderOnlineById,
  updateOrderOnlineStatus,
  deleteOrderOnline,
};
