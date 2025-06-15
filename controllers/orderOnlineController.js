const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createOrderOnline = async (req, res) => {
  try {
    const {
      items,
      branchId,
      fullName,
      phone,
      address,
      district,
      province,
      postalCode,
      note,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "ไม่มีรายการสินค้า" });
    }

    if (!branchId) {
      return res.status(400).json({ error: "กรุณาเลือกสาขา" });
    }

    const customerId = req.user?.customerProfileId || null; // ✅ รองรับ customer จาก token

    const order = await prisma.orderOnline.create({
      data: {
        customerId,
        branchId,
        fullName,
        phone,
        address,
        district,
        province,
        postalCode,
        note,
        status: "PENDING",
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: { product: true },
        },
        customer: {
          include: { user: true },
        },
        branch: true,
      },
    });

    res.status(201).json(order);
  } catch (err) {
    console.error("❌ createOrderOnline error:", err);
    res.status(500).json({ error: "ไม่สามารถสร้างคำสั่งซื้อได้" });
  }
};

const getAllOrdersOnline = async (req, res) => {
  try {
    const orders = await prisma.orderOnline.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: { product: true },
        },
        customer: true,
        branch: true,
      },
    });
    res.json(orders);
  } catch (err) {
    console.error("❌ getAllOrdersOnline error:", err);
    res.status(500).json({ error: "ไม่สามารถดึงรายการคำสั่งซื้อได้" });
  }
};

const getOrderOnlineById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.orderOnline.findUnique({
      where: { id: Number(id) },
      include: {
        items: {
          include: { product: true },
        },
        customer: true,
        branch: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: "ไม่พบคำสั่งซื้อนี้" });
    }

    res.json(order);
  } catch (err) {
    console.error("❌ getOrderOnlineById error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหาคำสั่งซื้อ" });
  }
};

const deleteOrderOnline = async (req, res) => {
  try {
    const { id } = req.params;

    // ลบ items ก่อนตาม foreign key constraint
    await prisma.orderOnlineItem.deleteMany({
      where: { orderId: Number(id) },
    });

    await prisma.orderOnline.delete({
      where: { id: Number(id) },
    });

    res.json({ message: "ลบคำสั่งซื้อเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("❌ deleteOrderOnline error:", err);
    res.status(500).json({ error: "ไม่สามารถลบคำสั่งซื้อได้" });
  }
};

module.exports = {
  createOrderOnline,
  getAllOrdersOnline,
  getOrderOnlineById,
  deleteOrderOnline,
};
