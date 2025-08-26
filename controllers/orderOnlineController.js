// orderOnlineController.js

// ✅ Use shared Prisma singleton (no new PrismaClient here)
const { prisma, Prisma } = require('../lib/prisma');
const dayjs = require('dayjs');

// ---- helpers ----
const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v || 0));
const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v || 0));
const pad = (n, len = 2) => String(n).padStart(len, '0');

// ---- code generator (atomic inside same client/tx) ----
const generateOrderOnlineCode = async (client, branchId) => {
  const today = dayjs().format('YYMMDD');
  // Count orders created today for this branch
  const start = dayjs().startOf('day').toDate();
  const end = dayjs().endOf('day').toDate();
  const count = await client.orderOnline.count({
    where: { branchId, createdAt: { gte: start, lte: end } },
  });
  const seq = pad(count + 1, 3);
  return `ORD${pad(branchId, 2)}-${today}-${seq}`; // e.g., ORD01-250826-003
};

// ---- Create order online (BRANCH_SCOPE_ENFORCED) ----
const createOrderOnline = async (req, res) => {
  try {
    const {
      items = [],
      customerId,
      deliveryDate,
      note,
    } = req.body;

    const userId = req.user?.id || null;
    const branchId = Number(req.user?.branchId);

    if (!branchId || !Array.isArray(items) || items.length === 0) {
      console.warn('🛑 ข้อมูลไม่ครบ:', { branchId, itemsLength: items?.length });
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    // Validate productIds
    const productIds = items.map((it) => Number(it.productId)).filter(Boolean);
    if (productIds.length !== items.length) {
      return res.status(400).json({ error: 'พบรายการสินค้าที่ไม่มี productId ที่ถูกต้อง' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Pull branch prices once
      const branchPrices = await tx.branchPrice.findMany({
        where: { branchId, productId: { in: productIds } },
        select: { productId: true, priceOnline: true },
      });

      const enrichedItems = items.map((item) => {
        const found = branchPrices.find((bp) => bp.productId === Number(item.productId));
        const price = toNum(found?.priceOnline) || 0;
        if (!found) {
          console.warn('⚠️ ไม่พบราคาใน branchPrices สำหรับ productId:', item.productId);
        }
        return {
          productId: Number(item.productId),
          quantity: Number(item.quantity) || 0,
          priceAtPurchase: price,
          note: item.note || '',
        };
      });

      const totalAmountDec = enrichedItems.reduce(
        (sum, it) => sum.plus(D(it.priceAtPurchase).times(it.quantity)),
        new Prisma.Decimal(0)
      );

      const code = await generateOrderOnlineCode(tx, branchId);

      const newOrder = await tx.orderOnline.create({
        data: {
          code,
          customerId: customerId || null,
          branchId,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          note: note || '',
          status: 'NEW',
          statusPayment: 'UNPAID',
          paymentMethod: 'CASH',
          source: 'ONLINE',
          totalAmount: totalAmountDec, // ✅ keep as Decimal
          items: { create: enrichedItems },
          userId,
        },
      });

      // Clear cart for this user (if any)
      if (userId) {
        await tx.cartItem.deleteMany({ where: { cart: { userId } } });
        await tx.cart.deleteMany({ where: { userId } });
      }

      return newOrder;
    }, { timeout: 20000 });

    res.status(201).json({ message: 'สร้างคำสั่งซื้อสำเร็จ', order: result });
  } catch (error) {
    console.error('❌ createOrderOnline error:', error);
    console.error('📦 req.body:', req.body);
    res.status(500).json({ error: 'ไม่สามารถสร้างคำสั่งซื้อได้' });
  }
};

// ---- List orders for employee (branch scope) ----
const getAllOrderOnline = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const status = req.query.status;

    const where = {
      branchId,
      ...(status && status !== 'ALL' && { status }),
    };

    const orders = await prisma.orderOnline.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
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

// ---- Update order (employee or owner) ----
const updateOrderOnlineStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { statusPayment, deliveryDate, note } = req.body; // ✅ use statusPayment consistently
    const userId = req.user?.id;
    const isEmployee = !!req.user?.branchId;

    const existingOrder = await prisma.orderOnline.findUnique({ where: { id: Number(id) } });
    if (!existingOrder) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });

    if (!isEmployee && existingOrder.customerId !== (await prisma.customerProfile.findFirst({ where: { userId }, select: { id: true } }))?.id) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์อัปเดตคำสั่งซื้อนี้' });
    }

    if (isEmployee && existingOrder.branchId !== Number(req.user.branchId)) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์อัปเดตคำสั่งซื้อของสาขาอื่น' });
    }

    const updated = await prisma.orderOnline.update({
      where: { id: Number(id) },
      data: {
        statusPayment: statusPayment || existingOrder.statusPayment,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : existingOrder.deliveryDate,
        note: note ?? existingOrder.note,
      },
    });

    res.json({ message: 'อัปเดตคำสั่งซื้อสำเร็จ', order: updated });
  } catch (error) {
    console.error('❌ updateOrderOnlineStatus error:', error);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตคำสั่งซื้อได้' });
  }
};

// ---- Delete order (employee or owner) ----
const deleteOrderOnline = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isEmployee = !!req.user?.branchId;

    const existingOrder = await prisma.orderOnline.findUnique({ where: { id: Number(id) } });
    if (!existingOrder) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });

    if (!isEmployee) {
      const customerProfile = await prisma.customerProfile.findFirst({ where: { userId }, select: { id: true } });
      if (!customerProfile || existingOrder.customerId !== customerProfile.id) {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบคำสั่งซื้อนี้' });
      }
    } else if (existingOrder.branchId !== Number(req.user.branchId)) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบคำสั่งซื้อของสาขาอื่น' });
    }

    await prisma.orderOnline.delete({ where: { id: Number(id) } });
    res.json({ message: 'ลบคำสั่งซื้อสำเร็จ' });
  } catch (error) {
    console.error('❌ deleteOrderOnline error:', error);
    res.status(500).json({ error: 'ไม่สามารถลบคำสั่งซื้อได้' });
  }
};

// ---- Get order detail for employee ----
const getOrderOnlineByIdForEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.orderOnline.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (!order) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    if (order.branchId !== Number(req.user.branchId)) return res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อของสาขาอื่น' });

    const formattedOrder = {
      id: order.id,
      code: order.code,
      customerName: order.customer?.name,
      customerPhone: order.customer?.phone,
      customerAddress: [order.customer?.address, order.customer?.district, order.customer?.province, order.customer?.postalCode].filter(Boolean).join(' '),
      status: order.status,
      paymentSlipStatus: order.paymentSlipStatus,
      statusPayment: order.statusPayment,
      totalAmount: toNum(order.totalAmount),
      createdAt: order.createdAt,
      slipImageUrl: order.paymentSlipUrl || null,
      items: order.items.map((item) => {
        const unitPrice = toNum(item.priceAtPurchase);
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          totalPrice: unitPrice * item.quantity,
          product: { name: item.product?.name || '' },
        };
      }),
    };

    res.json(formattedOrder);
  } catch (error) {
    console.error('❌ getOrderOnlineByIdForEmployee error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้' });
  }
};

// ---- Get order detail for customer ----
const getOrderOnlineByIdForCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
    if (!customerProfile) return res.status(403).json({ error: 'ไม่พบข้อมูลลูกค้า' });

    const order = await prisma.orderOnline.findUnique({
      where: { id: Number(id) },
      include: { customer: true, items: { include: { product: true } } },
    });

    if (!order || order.customerId !== customerProfile.id) return res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้' });

    const formattedOrder = {
      id: order.id,
      code: order.code,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      customerAddress: [order.customer.address, order.customer.district, order.customer.province, order.customer.postalCode].filter(Boolean).join(' '),
      status: order.status,
      totalAmount: toNum(order.totalAmount),
      createdAt: order.createdAt,
      items: order.items.map((item) => {
        const unitPrice = toNum(item.priceAtPurchase);
        return { productName: item.product.name, quantity: item.quantity, unitPrice, totalPrice: unitPrice * item.quantity };
      }),
    };

    res.json(formattedOrder);
  } catch (error) {
    console.error('❌ getOrderOnlineByIdForCustomer error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้' });
  }
};

// ---- List orders for current customer ----
const getOrderOnlineByCustomer = async (req, res) => {
  try {
    const userId = req.user?.id;
    const status = req.query.status;

    const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
    if (!customerProfile) return res.status(404).json({ error: 'ไม่พบข้อมูลลูกค้า' });

    const where = { customerId: customerProfile.id, ...(status && status !== 'ALL' && { status }) };

    const orders = await prisma.orderOnline.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, companyName: true, phone: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = orders.map((order) => {
      const totalAmount = order.items.reduce((sum, it) => sum + toNum(it.priceAtPurchase) * it.quantity, 0);
      const paymentStatusLabel = order.statusPayment === 'PAID' ? 'ชำระแล้ว' : 'ยังไม่ชำระ';
      return { ...order, totalAmount, paymentStatusLabel };
    });

    res.json(formatted);
  } catch (error) {
    console.error('❌ getOrderOnlineByCustomer error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงคำสั่งซื้อของคุณได้' });
  }
};

// ---- List for employee (alt) ----
const getOrderOnlineList = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const status = req.query.status;

    const where = { branchId, ...(status && status !== 'ALL' && { status }) };

    const orders = await prisma.orderOnline.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { id: true, name: true } } },
    });

    res.json(orders);
  } catch (error) {
    console.error('❌ [getOrderOnlineList] error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ' });
  }
};

// ---- Payment slip submission ----
const submitOrderOnlinePaymentSlip = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { note = '', slipUrl } = req.body;

    const order = await prisma.orderOnline.findUnique({ where: { id: Number(orderId) } });
    if (!order) return res.status(404).json({ message: 'ไม่พบคำสั่งซื้อ' });
    if (order.statusPayment === 'PAID') return res.status(400).json({ message: 'คำสั่งซื้อนี้ชำระเงินแล้ว' });

    const imageUrl = slipUrl?.url || slipUrl || null;

    await prisma.orderOnline.update({
      where: { id: Number(orderId) },
      data: {
        paymentNote: note,
        paymentSlipUrl: imageUrl,
        statusPayment: 'WAITING_APPROVAL',
        paymentSlipStatus: 'WAITING_APPROVAL',
      },
    });

    return res.json({ message: 'ส่งข้อมูลการชำระเงินเรียบร้อยแล้ว กรุณารอการตรวจสอบสลิป' });
  } catch (error) {
    console.error('submitOrderOnlinePaymentSlip error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการส่งข้อมูลการชำระเงิน' });
  }
};

// ---- Approve slip ----
const approveOrderOnlineSlip = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.orderOnline.findUnique({ where: { id: Number(id) } });
    if (!order) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    if (order.branchId !== Number(req.user.branchId)) return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ยืนยันคำสั่งซื้อของสาขาอื่น' });
    if (order.statusPayment === 'PAID') return res.status(400).json({ error: 'คำสั่งซื้อนี้ชำระเงินแล้ว' });

    const updated = await prisma.orderOnline.update({
      where: { id: Number(id) },
      data: {
        statusPayment: 'PAID',
        paymentDate: new Date(),
        paymentSlipStatus: 'APPROVED',
        confirmedByEmployeeId: req.user.employeeId || null,
      },
    });

    res.json({ message: 'อนุมัติสลิปการชำระเงินสำเร็จ', order: updated });
  } catch (error) {
    console.error('❌ approveOrderOnlineSlip error:', error);
    res.status(500).json({ error: 'ไม่สามารถอนุมัติการชำระเงินได้' });
  }
};

// ---- Reject slip ----
const rejectOrderOnlineSlip = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.orderOnline.findUnique({ where: { id: Number(id) } });
    if (!order) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    if (order.branchId !== Number(req.user.branchId)) return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดำเนินการกับคำสั่งซื้อของสาขาอื่น' });
    if (order.paymentSlipStatus !== 'WAITING_APPROVAL') return res.status(400).json({ error: 'ไม่สามารถปฏิเสธสลิปในสถานะนี้ได้' });

    const updated = await prisma.orderOnline.update({
      where: { id: Number(id) },
      data: {
        paymentSlipStatus: 'REJECTED',
        statusPayment: 'NONE',
        paymentDate: null,
        confirmedByEmployeeId: null,
      },
    });

    res.json({ message: 'ปฏิเสธสลิปเรียบร้อยแล้ว', order: updated });
  } catch (error) {
    console.error('❌ rejectOrderOnlineSlip error:', error);
    res.status(500).json({ error: 'ไม่สามารถปฏิเสธสลิปได้' });
  }
};

// ---- List by branch (formatted) ----
const getOrderOnlineByBranch = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);

    const orders = await prisma.orderOnline.findMany({
      where: { branchId },
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = orders.map((order) => {
      const totalAmount = order.items.reduce((sum, it) => sum + toNum(it.priceAtPurchase) * it.quantity, 0);
      return {
        id: order.id,
        code: order.code,
        createdAt: order.createdAt,
        status: order.status,
        paymentSlipStatus: order.paymentSlipStatus,
        statusPayment: order.statusPayment,
        customerName: order.customer?.name || '-',
        totalAmount,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('❌ getOrderOnlineByBranch error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงคำสั่งซื้อได้' });
  }
};

// ---- Deep summary for branch ----
const getOrderOnlineSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = Number(req.user?.branchId);

    const order = await prisma.orderOnline.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: {
                template: {
                  include: {
                    productProfile: { include: { productType: { include: { category: true } } } },
                  },
                },
                branchPrice: { where: { branchId } },
              },
            },
          },
        },
      },
    });

    if (!order) return res.status(404).json({ message: 'ไม่พบคำสั่งซื้อนี้' });

    res.json(order);
  } catch (error) {
    console.error('❌ getOrderOnlineSummary error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ' });
  }
};

module.exports = {
  createOrderOnline,
  getAllOrderOnline,
  getOrderOnlineByIdForEmployee,
  getOrderOnlineByIdForCustomer,
  updateOrderOnlineStatus,
  deleteOrderOnline,
  getOrderOnlineList,
  getOrderOnlineByCustomer,
  submitOrderOnlinePaymentSlip,
  approveOrderOnlineSlip,
  rejectOrderOnlineSlip,
  getOrderOnlineByBranch,
  getOrderOnlineSummary,
};
