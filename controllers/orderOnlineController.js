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
        statusPayment: 'UNPAID',
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
    const branchId = req.user.branchId;
    const status = req.query.status;

    const where = {
      branchId,
      ...(status && status !== 'ALL' && { status }),
    };

    const orders = await prisma.orderOnline.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
          },
        },
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


const updateOrderOnlineStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, deliveryDate, note } = req.body;
    const userId = req.user?.id;
    const isEmployee = !!req.user?.branchId;

    const existingOrder = await prisma.orderOnline.findUnique({
      where: { id: Number(id) },
    });

    if (!existingOrder) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    }

    if (!isEmployee && existingOrder.customerId !== userId) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์อัปเดตคำสั่งซื้อนี้' });
    }

    if (isEmployee && existingOrder.branchId !== req.user.branchId) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์อัปเดตคำสั่งซื้อของสาขาอื่น' });
    }

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
    const userId = req.user?.id;
    const isEmployee = !!req.user?.branchId;

    const existingOrder = await prisma.orderOnline.findUnique({
      where: { id: Number(id) },
    });

    if (!existingOrder) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    }

    if (!isEmployee && existingOrder.customerId !== userId) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบคำสั่งซื้อนี้' });
    }

    if (isEmployee && existingOrder.branchId !== req.user.branchId) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบคำสั่งซื้อของสาขาอื่น' });
    }

    await prisma.orderOnline.delete({
      where: { id: Number(id) },
    });

    res.json({ message: 'ลบคำสั่งซื้อสำเร็จ' });
  } catch (error) {
    console.error('❌ deleteOrderOnline error:', error);
    res.status(500).json({ error: 'ไม่สามารถลบคำสั่งซื้อได้' });
  }
};


const getOrderOnlineByIdForEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.orderOnline.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        items: {
          include: {
            product: true, // ✅ ensure product details are included
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    }

    if (order.branchId !== req.user.branchId) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อของสาขาอื่น' });
    }

    const formattedOrder = {
      id: order.id,
      code: order.code,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      customerAddress: [
        order.customer.address,
        order.customer.district,
        order.customer.province,
        order.customer.postalCode,
      ].filter(Boolean).join(' '),
      status: order.status,
      paymentSlipStatus: order.paymentSlipStatus,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      slipImageUrl: order.paymentSlipUrl || null,
      items: order.items.map((item) => {
        const unitPrice = Number(item.priceAtPurchase) || 0;
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          totalPrice: item.quantity * unitPrice,
          product: {
            name: item.product?.name || '',
          },
        };
      }),
    };

    res.json(formattedOrder);
  } catch (error) {
    console.error('❌ getOrderOnlineByIdForEmployee error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้' });
  }
};



const getOrderOnlineByIdForCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(403).json({ error: 'ไม่พบข้อมูลลูกค้า' });
    }

    const order = await prisma.orderOnline.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (!order || order.customerId !== customerProfile.id) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้' });
    }

    const formattedOrder = {
      id: order.id,
      code: order.code,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      customerAddress: [
        order.customer.address,
        order.customer.district,
        order.customer.province,
        order.customer.postalCode
      ].filter(Boolean).join(' '),
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      items: order.items.map((item) => {
        const unitPrice = Number(item.priceAtPurchase) || 0;
        return {
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice,
          totalPrice: item.quantity * unitPrice,
        };
      }),
    };

    res.json(formattedOrder);
  } catch (error) {
    console.error('❌ getOrderOnlineByIdForCustomer error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้' });
  }
};


const getOrderOnlineByCustomer = async (req, res) => {
  try {
    const userId = req.user?.id;
    const status = req.query.status;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลลูกค้า' });
    }

    const where = {
      customerId: customerProfile.id,
      ...(status && status !== 'ALL' && { status }),
    };

    const orders = await prisma.orderOnline.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            companyName: true,
            phone: true,
          },
        },
        
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = orders.map((order) => {
  const totalAmount = order.items.reduce((sum, item) => {
    return sum + (item.priceAtPurchase || 0) * item.quantity;
  }, 0);

  const paymentStatusLabel = order.statusPayment === 'PAID' ? 'ชำระแล้ว' : 'ยังไม่ชำระ';

  return { ...order, totalAmount, paymentStatusLabel };
});
res.json(formatted);
  } catch (error) {
    console.error('❌ getOrderOnlineByCustomer error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงคำสั่งซื้อของคุณได้' });
  }
};


const getOrderOnlineList = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const status = req.query.status;

    const where = {
      branchId,
      ...(status && status !== 'ALL' && { status }),
    };

    const orders = await prisma.orderOnline.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    res.json(orders);
  } catch (error) {
    console.error('❌ [getOrderOnlineList] error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ' });
  }
};


const submitOrderOnlinePaymentSlip = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { note = '', slipUrl } = req.body;

    const order = await prisma.orderOnline.findUnique({
      where: { id: Number(orderId) },
    });

    if (!order) {
      return res.status(404).json({ message: 'ไม่พบคำสั่งซื้อ' });
    }

    if (order.statusPayment === 'PAID') {
      return res.status(400).json({ message: 'คำสั่งซื้อนี้ชำระเงินแล้ว' });
    }

    const imageUrl = slipUrl?.url || slipUrl;
    console.log('📦 slipUrl =', imageUrl);

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


const approveOrderOnlineSlip = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.orderOnline.findUnique({
      where: { id: Number(id) },
    });

    if (!order) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    }

    if (order.branchId !== req.user.branchId) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ยืนยันคำสั่งซื้อของสาขาอื่น' });
    }

    if (order.statusPayment === 'PAID') {
      return res.status(400).json({ error: 'คำสั่งซื้อนี้ชำระเงินแล้ว' });
    }

    const updated = await prisma.orderOnline.update({
      where: { id: Number(id) },
      data: {
        statusPayment: 'PAID', // ✅ ใช้ชื่อที่ตรงกับ Prisma schema
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


const rejectOrderOnlineSlip = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.orderOnline.findUnique({
      where: { id: Number(id) },
    });

    if (!order) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    }

    if (order.branchId !== req.user.branchId) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดำเนินการกับคำสั่งซื้อของสาขาอื่น' });
    }

    if (order.paymentSlipStatus !== 'WAITING_APPROVAL') {
      return res.status(400).json({ error: 'ไม่สามารถปฏิเสธสลิปในสถานะนี้ได้' });
    }

    const updated = await prisma.orderOnline.update({
      where: { id: Number(id) },
      data: {
        paymentSlipStatus: 'REJECTED',
        statusPayment: 'NONE',               // ✅ reset สถานะการชำระเงิน
        paymentDate: null,                   // ✅ ล้างวันที่
        confirmedByEmployeeId: null,        // ✅ ล้างผู้อนุมัติ
      },
    });

    res.json({ message: 'ปฏิเสธสลิปเรียบร้อยแล้ว', order: updated });
  } catch (error) {
    console.error('❌ rejectOrderOnlineSlip error:', error);
    res.status(500).json({ error: 'ไม่สามารถปฏิเสธสลิปได้' });
  }
};


const getOrderOnlineByBranch = async (req, res) => {
  try {
    const branchId = req.user.branchId;

    const orders = await prisma.orderOnline.findMany({
      where: { branchId },
      include: {
        customer: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = orders.map((order) => {
      const totalAmount = order.items.reduce((sum, item) => {
        const unitPrice = Number(item.priceAtPurchase) || 0;
        return sum + unitPrice * item.quantity;
      }, 0);

      return {
        id: order.id,
        code: order.code,
        createdAt: order.createdAt,
        status: order.status,
        paymentSlipStatus: order.paymentSlipStatus, // ✅ เพิ่มให้ส่งค่า paymentSlipStatus
        statusPayment: order.statusPayment,         // ✅ เพิ่มให้ส่งค่า statusPayment
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


const getOrderOnlineSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = req.user.branchId;

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
                    productProfile: {
                      include: {
                        productType: {
                          include: {
                            category: true,
                          },
                        },
                      },
                    },
                  },
                },
                branchPrice: {
                  where: { branchId },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'ไม่พบคำสั่งซื้อนี้' });
    }

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
