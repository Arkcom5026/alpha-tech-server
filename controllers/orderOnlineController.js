
// orderOnlineController.js

// ✅ Use shared Prisma singleton (no new PrismaClient here)
const { prisma, Prisma } = require('../lib/prisma');
const dayjs = require('dayjs');

// ---- helpers ----
const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v || 0));
const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v || 0));
const pad = (n, len = 2) => String(n).padStart(len, '0');

const safeDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  // invalid date => null
  return Number.isNaN(d.getTime()) ? null : d;
};

const buildCustomerAddress = (customer) => {
  if (!customer) return '';
  const addressDetail = customer.addressDetail || '';
  const sub = customer.subdistrict;
  const dist = sub?.district;
  const prov = dist?.province;

  // ✅ Thai format (minimal, no extra DB fields)
  const parts = [
    addressDetail,
    sub?.nameTh ? `ต.${sub.nameTh}` : '',
    dist?.nameTh ? `อ.${dist.nameTh}` : '',
    prov?.nameTh ? `จ.${prov.nameTh}` : '',
    sub?.postcode || '',
  ].filter(Boolean);

  return parts.join(' ');
};

// ---- code generator (best-effort uniqueness + retry) ----
const generateOrderOnlineCode = async (client, branchId) => {
  const today = dayjs().format('YYMMDD');
  const start = dayjs().startOf('day').toDate();
  const end = dayjs().endOf('day').toDate();

  // ⚠️ Count-based sequence can race under concurrency.
  // We will mitigate with create retry on unique violation.
  const count = await client.orderOnline.count({
    where: { branchId, createdAt: { gte: start, lte: end } },
  });

  const seq = pad(count + 1, 3);
  return `ORD${pad(branchId, 2)}-${today}-${seq}`; // e.g., ORD01-250826-003
};

// ---- Create order online (BRANCH_SCOPE_ENFORCED) ----
const createOrderOnline = async (req, res) => {
  try {
    const { items = [], customerId, deliveryDate, note } = req.body;

    const userId = req.user?.id || null;
    const branchId = Number(req.user?.branchId);

    if (!branchId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    // Validate items
    const normalized = items.map((it) => ({
      productId: Number(it?.productId),
      quantity: Number(it?.quantity),
      note: typeof it?.note === 'string' ? it.note : '',
    }));

    if (normalized.some((it) => !Number.isFinite(it.productId) || it.productId <= 0)) {
      return res.status(400).json({ error: 'พบรายการสินค้าที่ไม่มี productId ที่ถูกต้อง' });
    }

    if (normalized.some((it) => !Number.isFinite(it.quantity) || it.quantity <= 0)) {
      return res.status(400).json({ error: 'จำนวนสินค้าไม่ถูกต้อง (ต้องมากกว่า 0)' });
    }

    const productIds = normalized.map((it) => it.productId);

    const result = await prisma.$transaction(
      async (tx) => {
        // Pull branch prices once (Online must have priceOnline + active)
        const branchPrices = await tx.branchPrice.findMany({
          where: { branchId, productId: { in: productIds } },
          select: { productId: true, priceOnline: true, isActive: true },
        });

        const priceMap = new Map(branchPrices.map((bp) => [bp.productId, bp]));

        // Enforce: must have active priceOnline (Executive-grade UX safety)
        const unavailable = normalized
          .filter((it) => {
            const bp = priceMap.get(it.productId);
            const price = toNum(bp?.priceOnline);
            return !bp || bp?.isActive === false || !Number.isFinite(price) || price <= 0;
          })
          .map((it) => it.productId);

        if (unavailable.length > 0) {
          return res.status(400).json({
            error: 'พบสินค้าบางรายการไม่พร้อมขายออนไลน์ (ไม่มีราคาออนไลน์หรือถูกปิดใช้งาน)',
            unavailableProductIds: unavailable,
          });
        }

        const enrichedItems = normalized.map((item) => {
          const bp = priceMap.get(item.productId);
          const price = toNum(bp?.priceOnline) || 0;
          return {
            productId: item.productId,
            quantity: item.quantity,
            priceAtPurchase: price,
            note: item.note || '',
          };
        });

        const totalAmountDec = enrichedItems.reduce(
          (sum, it) => sum.plus(D(it.priceAtPurchase).times(it.quantity)),
          new Prisma.Decimal(0)
        );

        // Create with retry if code collides
        let lastErr = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const code = await generateOrderOnlineCode(tx, branchId);

            const newOrder = await tx.orderOnline.create({
              data: {
                code,
                customerId: customerId || null,
                branchId,
                deliveryDate: safeDate(deliveryDate),
                note: note || '',
                // ✅ Use enum values from schema
                status: 'PENDING',
                statusPayment: 'UNPAID',
                paymentMethod: 'CASH',
                source: 'ONLINE',
                items: { create: enrichedItems },
                userId,
              },
              include: {
                customer: {
                  include: {
                    subdistrict: { include: { district: { include: { province: true } } } },
                  },
                },
                items: { include: { product: { include: { brand: true } } } },
              },
            });

            // Clear cart for this user (if any)
            if (userId) {
              await tx.cartItem.deleteMany({ where: { cart: { userId } } });
              await tx.cart.deleteMany({ where: { userId } });
            }

            return {
              ...newOrder,
              totalAmount: toNum(totalAmountDec),
              customerAddress: buildCustomerAddress(newOrder.customer),
            };
          } catch (e) {
            lastErr = e;
            const msg = String(e?.message || '');
            // Prisma unique violation (best-effort) => retry
            if (msg.includes('Unique constraint') || msg.includes('P2002')) continue;
            throw e;
          }
        }

        throw lastErr || new Error('Failed to create order');
      },
      { timeout: 20000 }
    );

    return res.status(201).json({ message: 'สร้างคำสั่งซื้อสำเร็จ', order: result });
  } catch (error) {
    console.error('❌ createOrderOnline error:', error);
    console.error('📦 req.body:', req.body);
    return res.status(500).json({ error: 'ไม่สามารถสร้างคำสั่งซื้อได้' });
  }
};

// ---- List orders for employee (branch scope) ----
const getAllOrderOnline = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const status = req.query.status;

    if (!branchId) return res.status(400).json({ error: 'branchId ไม่ถูกต้อง' });

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
            name: true,
            companyName: true,
            addressDetail: true,
            subdistrict: {
              select: {
                code: true,
                nameTh: true,
                postcode: true,
                district: {
                  select: {
                    code: true,
                    nameTh: true,
                    province: { select: { code: true, nameTh: true } },
                  },
                },
              },
            },
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = orders.map((o) => {
      const totalAmount = o.items.reduce((sum, it) => sum + toNum(it.priceAtPurchase) * it.quantity, 0);
      return {
        ...o,
        totalAmount,
        customerAddress: buildCustomerAddress(o.customer),
      };
    });

    return res.json(formatted);
  } catch (error) {
    console.error('❌ getAllOrderOnline error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้' });
  }
};

// ---- Update order (employee or owner) ----
const updateOrderOnlineStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, statusPayment, deliveryDate, note } = req.body;

    const userId = req.user?.id;
    const branchId = Number(req.user?.branchId);
    const isEmployee = Number.isFinite(branchId) && branchId > 0;

    const orderId = Number(id);
    if (!Number.isFinite(orderId) || orderId <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const existingOrder = await prisma.orderOnline.findUnique({ where: { id: orderId } });
    if (!existingOrder) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });

    if (isEmployee) {
      if (existingOrder.branchId !== branchId) {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์อัปเดตคำสั่งซื้อของสาขาอื่น' });
      }
    } else {
      const customerProfile = await prisma.customerProfile.findFirst({ where: { userId }, select: { id: true } });
      if (!customerProfile || existingOrder.customerId !== customerProfile.id) {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์อัปเดตคำสั่งซื้อนี้' });
      }
    }

    // ✅ Keep update surface small & safe
    const updated = await prisma.orderOnline.update({
      where: { id: orderId },
      data: {
        ...(status ? { status } : {}),
        ...(statusPayment ? { statusPayment } : {}),
        ...(deliveryDate !== undefined ? { deliveryDate: safeDate(deliveryDate) } : {}),
        ...(note !== undefined ? { note: note ?? '' } : {}),
      },
    });

    return res.json({ message: 'อัปเดตคำสั่งซื้อสำเร็จ', order: updated });
  } catch (error) {
    console.error('❌ updateOrderOnlineStatus error:', error);
    return res.status(500).json({ error: 'ไม่สามารถอัปเดตคำสั่งซื้อได้' });
  }
};

// ---- Delete order (employee or owner) ----
const deleteOrderOnline = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const branchId = Number(req.user?.branchId);
    const isEmployee = Number.isFinite(branchId) && branchId > 0;

    const orderId = Number(id);
    if (!Number.isFinite(orderId) || orderId <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const existingOrder = await prisma.orderOnline.findUnique({ where: { id: orderId } });
    if (!existingOrder) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });

    if (!isEmployee) {
      const customerProfile = await prisma.customerProfile.findFirst({ where: { userId }, select: { id: true } });
      if (!customerProfile || existingOrder.customerId !== customerProfile.id) {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบคำสั่งซื้อนี้' });
      }
    } else if (existingOrder.branchId !== branchId) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบคำสั่งซื้อของสาขาอื่น' });
    }

    await prisma.orderOnline.delete({ where: { id: orderId } });
    return res.json({ message: 'ลบคำสั่งซื้อสำเร็จ' });
  } catch (error) {
    console.error('❌ deleteOrderOnline error:', error);
    return res.status(500).json({ error: 'ไม่สามารถลบคำสั่งซื้อได้' });
  }
};

// ---- Get order detail for employee ----
const getOrderOnlineByIdForEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = Number(req.user?.branchId);

    const orderId = Number(id);
    if (!Number.isFinite(orderId) || orderId <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const order = await prisma.orderOnline.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: {
            subdistrict: { include: { district: { include: { province: true } } } },
          },
        },
        items: {
          include: {
            product: { include: { brand: true } },
          },
        },
      },
    });

    if (!order) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    if (order.branchId !== branchId) return res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อของสาขาอื่น' });

    const totalAmount = order.items.reduce((sum, it) => sum + toNum(it.priceAtPurchase) * it.quantity, 0);

    const formattedOrder = {
      id: order.id,
      code: order.code,
      status: order.status,
      paymentSlipStatus: order.paymentSlipStatus,
      statusPayment: order.statusPayment,
      paymentMethod: order.paymentMethod,
      deliveryDate: order.deliveryDate,
      paymentNote: order.paymentNote || '',
      slipImageUrl: order.paymentSlipUrl || null,
      createdAt: order.createdAt,
      totalAmount,

      customer: order.customer
        ? {
            id: order.customer.id,
            name: order.customer.name,
            companyName: order.customer.companyName,
            taxId: order.customer.taxId,
            addressDetail: order.customer.addressDetail,
            subdistrictCode: order.customer.subdistrictCode,
            customerAddress: buildCustomerAddress(order.customer),
          }
        : null,

      items: order.items.map((item) => {
        const unitPrice = toNum(item.priceAtPurchase);
        return {
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          totalPrice: unitPrice * item.quantity,
          note: item.note || '',
          product: {
            id: item.product?.id,
            name: item.product?.name || '',
            brandId: item.product?.brandId || null,
            brandName: item.product?.brand?.name || null,
          },
        };
      }),
    };

    return res.json(formattedOrder);
  } catch (error) {
    console.error('❌ getOrderOnlineByIdForEmployee error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้' });
  }
};

// ---- Get order detail for customer ----
const getOrderOnlineByIdForCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const orderId = Number(id);
    if (!Number.isFinite(orderId) || orderId <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { subdistrict: { include: { district: { include: { province: true } } } } },
    });

    if (!customerProfile) return res.status(403).json({ error: 'ไม่พบข้อมูลลูกค้า' });

    const order = await prisma.orderOnline.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: { subdistrict: { include: { district: { include: { province: true } } } } },
        },
        items: { include: { product: { include: { brand: true } } } },
      },
    });

    if (!order || order.customerId !== customerProfile.id) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้' });
    }

    const totalAmount = order.items.reduce((sum, it) => sum + toNum(it.priceAtPurchase) * it.quantity, 0);

    const formattedOrder = {
      id: order.id,
      code: order.code,
      status: order.status,
      statusPayment: order.statusPayment,
      paymentSlipStatus: order.paymentSlipStatus,
      paymentMethod: order.paymentMethod,
      deliveryDate: order.deliveryDate,
      createdAt: order.createdAt,
      totalAmount,
      customerAddress: buildCustomerAddress(order.customer),
      items: order.items.map((item) => {
        const unitPrice = toNum(item.priceAtPurchase);
        return {
          productId: item.productId,
          productName: item.product?.name || '',
          brandName: item.product?.brand?.name || null,
          quantity: item.quantity,
          unitPrice,
          totalPrice: unitPrice * item.quantity,
        };
      }),
    };

    return res.json(formattedOrder);
  } catch (error) {
    console.error('❌ getOrderOnlineByIdForCustomer error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้' });
  }
};

// ---- List orders for current customer ----
const getOrderOnlineByCustomer = async (req, res) => {
  try {
    const userId = req.user?.id;
    const status = req.query.status;

    const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
    if (!customerProfile) return res.status(404).json({ error: 'ไม่พบข้อมูลลูกค้า' });

    const where = {
      customerId: customerProfile.id,
      ...(status && status !== 'ALL' && { status }),
    };

    const orders = await prisma.orderOnline.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = orders.map((order) => {
      const totalAmount = order.items.reduce((sum, it) => sum + toNum(it.priceAtPurchase) * it.quantity, 0);
      const paymentStatusLabel = order.statusPayment === 'PAID' ? 'ชำระแล้ว' : 'ยังไม่ชำระ';
      return { ...order, totalAmount, paymentStatusLabel };
    });

    return res.json(formatted);
  } catch (error) {
    console.error('❌ getOrderOnlineByCustomer error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงคำสั่งซื้อของคุณได้' });
  }
};

// ---- List for employee (alt) ----
const getOrderOnlineList = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const status = req.query.status;

    if (!branchId) return res.status(400).json({ error: 'branchId ไม่ถูกต้อง' });

    const where = { branchId, ...(status && status !== 'ALL' && { status }) };

    const orders = await prisma.orderOnline.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { id: true, name: true, companyName: true } }, items: true },
    });

    const formatted = orders.map((o) => ({
      ...o,
      totalAmount: o.items.reduce((sum, it) => sum + toNum(it.priceAtPurchase) * it.quantity, 0),
    }));

    return res.json(formatted);
  } catch (error) {
    console.error('❌ [getOrderOnlineList] error:', error);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ' });
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

    return res.json({ message: 'อนุมัติสลิปการชำระเงินสำเร็จ', order: updated });
  } catch (error) {
    console.error('❌ approveOrderOnlineSlip error:', error);
    return res.status(500).json({ error: 'ไม่สามารถอนุมัติการชำระเงินได้' });
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
        // ✅ schema uses PaymentStatus (no NONE)
        statusPayment: 'UNPAID',
        paymentDate: null,
        confirmedByEmployeeId: null,
      },
    });

    return res.json({ message: 'ปฏิเสธสลิปเรียบร้อยแล้ว', order: updated });
  } catch (error) {
    console.error('❌ rejectOrderOnlineSlip error:', error);
    return res.status(500).json({ error: 'ไม่สามารถปฏิเสธสลิปได้' });
  }
};

// ---- List by branch (formatted) ----
const getOrderOnlineByBranch = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(400).json({ error: 'branchId ไม่ถูกต้อง' });

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
        customerName: order.customer?.name || order.customer?.companyName || '-',
        totalAmount,
      };
    });

    return res.json(formatted);
  } catch (error) {
    console.error('❌ getOrderOnlineByBranch error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงคำสั่งซื้อได้' });
  }
};

// ---- Deep summary for branch (Executive-grade but schema-correct) ----
const getOrderOnlineSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = Number(req.user?.branchId);

    const orderId = Number(id);
    if (!Number.isFinite(orderId) || orderId <= 0) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const order = await prisma.orderOnline.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: {
            subdistrict: { include: { district: { include: { province: true } } } },
          },
        },
        items: {
          include: {
            product: {
              include: {
                brand: true,
                category: true,
                productType: true,
                productProfile: true,
                template: { include: { productProfile: true, unit: true } },
                branchPrice: { where: { branchId } },
              },
            },
          },
        },
      },
    });

    if (!order) return res.status(404).json({ message: 'ไม่พบคำสั่งซื้อนี้' });
    if (order.branchId !== branchId) return res.status(403).json({ message: 'คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อของสาขาอื่น' });

    const totalAmount = order.items.reduce((sum, it) => sum + toNum(it.priceAtPurchase) * it.quantity, 0);

    return res.json({
      ...order,
      totalAmount,
      customerAddress: buildCustomerAddress(order.customer),
    });
  } catch (error) {
    console.error('❌ getOrderOnlineSummary error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ' });
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
