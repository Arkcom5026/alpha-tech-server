const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createOrderOnline = async (req, res) => {
  try {
    const {
      items = [],
      customerId,
      branchId,
      totalAmount,
      deliveryDate,
      note,
    } = req.body;

    if (!branchId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    const newOrder = await prisma.orderOnline.create({
      data: {
        customerId: customerId || null,
        branchId,
        totalAmount: totalAmount || 0,
        deliveryDate: deliveryDate || undefined,
        note: note || '',
        paymentStatus: 'UNPAID',
        paymentMethod: 'UNKNOWN',
        source: 'ONLINE',
        orderItems: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            priceAtPurchase: item.price || 0,
            note: item.note || '',
          })),
        },
      },
    });

    res.status(201).json({ message: 'สร้างคำสั่งซื้อสำเร็จ', order: newOrder });
  } catch (error) {
    console.error('❌ createOrderOnline error:', error);
    res.status(500).json({ error: 'ไม่สามารถสร้างคำสั่งซื้อได้' });
  }
};

const getAllOrderOnline = async (req, res) => {
  try {
    const orders = await prisma.orderOnline.findMany({
      include: {
        customer: true,
        orderItems: true,
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
        orderItems: {
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
