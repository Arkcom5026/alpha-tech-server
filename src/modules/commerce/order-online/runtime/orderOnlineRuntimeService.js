const dayjs = require('dayjs');
const { Prisma } = require('../../../../../lib/prisma');
const repository = require('./orderOnlineRuntimeRepository');

const D = (value) => (
  value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value || 0)
);

const toNum = (value) => (
  value && typeof value.toNumber === 'function'
    ? value.toNumber()
    : Number(value || 0)
);

const pad = (value, length = 2) => String(value).padStart(length, '0');

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildCustomerAddress = (customer) => {
  if (!customer) return '';

  const parts = [
    customer.addressDetail || '',
    customer.subdistrict?.nameTh ? `ต.${customer.subdistrict.nameTh}` : '',
    customer.subdistrict?.district?.nameTh
      ? `อ.${customer.subdistrict.district.nameTh}`
      : '',
    customer.subdistrict?.district?.province?.nameTh
      ? `จ.${customer.subdistrict.district.province.nameTh}`
      : '',
    customer.subdistrict?.postcode || '',
  ].filter(Boolean);

  return parts.join(' ');
};

const calculateOrderTotal = (items = []) => items.reduce(
  (sum, item) => sum + toNum(item.priceAtPurchase) * Number(item.quantity || 0),
  0
);

const generateOrderOnlineCode = async (client, branchId) => {
  const today = dayjs().format('YYMMDD');
  const start = dayjs().startOf('day').toDate();
  const end = dayjs().endOf('day').toDate();
  const count = await repository.countOrdersCreatedInRange(client, {
    branchId,
    start,
    end,
  });

  return `ORD${pad(branchId, 2)}-${today}-${pad(count + 1, 3)}`;
};

const createOrderOnline = async ({ body = {}, user = {} }) => {
  const { items = [], customerId, deliveryDate, note } = body;
  const userId = user.id || null;
  const branchId = Number(user.branchId);

  if (!branchId || !Array.isArray(items) || items.length === 0) {
    return { status: 400, body: { error: 'ข้อมูลไม่ครบถ้วน' } };
  }

  const normalized = items.map((item) => ({
    productId: Number(item?.productId),
    quantity: Number(item?.quantity),
    note: typeof item?.note === 'string' ? item.note : '',
  }));

  if (normalized.some((item) => !Number.isFinite(item.productId) || item.productId <= 0)) {
    return {
      status: 400,
      body: { error: 'พบรายการสินค้าที่ไม่มี productId ที่ถูกต้อง' },
    };
  }

  if (normalized.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
    return {
      status: 400,
      body: { error: 'จำนวนสินค้าไม่ถูกต้อง (ต้องมากกว่า 0)' },
    };
  }

  const result = await repository.runTransaction(async (tx) => {
    const branchPrices = await repository.findBranchPrices(tx, {
      branchId,
      productIds: normalized.map((item) => item.productId),
    });
    const priceMap = new Map(branchPrices.map((price) => [price.productId, price]));
    const unavailableProductIds = normalized
      .filter((item) => {
        const branchPrice = priceMap.get(item.productId);
        const price = toNum(branchPrice?.priceOnline);
        return !branchPrice
          || branchPrice.isActive === false
          || !Number.isFinite(price)
          || price <= 0;
      })
      .map((item) => item.productId);

    if (unavailableProductIds.length > 0) {
      return {
        validationError: {
          status: 400,
          body: {
            error: 'พบสินค้าบางรายการไม่พร้อมขายออนไลน์ (ไม่มีราคาออนไลน์หรือถูกปิดใช้งาน)',
            unavailableProductIds,
          },
        },
      };
    }

    const enrichedItems = normalized.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      priceAtPurchase: toNum(priceMap.get(item.productId)?.priceOnline),
      note: item.note,
    }));
    const totalAmount = enrichedItems.reduce(
      (sum, item) => sum.plus(D(item.priceAtPurchase).times(item.quantity)),
      new Prisma.Decimal(0)
    );

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const code = await generateOrderOnlineCode(tx, branchId);
        const order = await repository.createOrder(tx, {
          code,
          customerId: customerId || null,
          branchId,
          deliveryDate: safeDate(deliveryDate),
          note: note || '',
          items: enrichedItems,
          userId,
        });

        if (userId) await repository.clearCartByUser(tx, userId);

        return {
          order: {
            ...order,
            totalAmount: toNum(totalAmount),
            customerAddress: buildCustomerAddress(order.customer),
          },
        };
      } catch (error) {
        lastError = error;
        const message = String(error?.message || '');
        if (message.includes('Unique constraint') || message.includes('P2002')) continue;
        throw error;
      }
    }

    throw lastError || new Error('Failed to create order');
  }, { timeout: 20000 });

  if (result.validationError) return result.validationError;

  return {
    status: 201,
    body: { message: 'สร้างคำสั่งซื้อสำเร็จ', order: result.order },
  };
};

const getAllOrderOnline = async ({ branchId, status }) => {
  const normalizedBranchId = Number(branchId);
  if (!normalizedBranchId) {
    return { status: 400, body: { error: 'branchId ไม่ถูกต้อง' } };
  }

  const orders = await repository.findOrders({
    where: {
      branchId: normalizedBranchId,
      ...(status && status !== 'ALL' ? { status } : {}),
    },
    mode: 'employee',
  });

  return {
    status: 200,
    body: orders.map((order) => ({
      ...order,
      totalAmount: calculateOrderTotal(order.items),
      customerAddress: buildCustomerAddress(order.customer),
    })),
  };
};

const getOrderOnlineByIdForEmployee = async ({ orderId, branchId }) => {
  const normalizedOrderId = Number(orderId);
  if (!Number.isFinite(normalizedOrderId) || normalizedOrderId <= 0) {
    return { status: 400, body: { error: 'id ไม่ถูกต้อง' } };
  }

  const order = await repository.findOrderById({
    orderId: normalizedOrderId,
    mode: 'detail',
  });
  if (!order) return { status: 404, body: { error: 'ไม่พบคำสั่งซื้อ' } };
  if (order.branchId !== Number(branchId)) {
    return {
      status: 403,
      body: { error: 'คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อของสาขาอื่น' },
    };
  }

  return {
    status: 200,
    body: {
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
      totalAmount: calculateOrderTotal(order.items),
      customer: order.customer
        ? {
            id: order.customer.id,
            name: order.customer.name,
            companyName: order.customer.companyName,
            address: buildCustomerAddress(order.customer),
          }
        : null,
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
    },
  };
};

const approveOrderOnlineSlip = async ({ orderId, user = {} }) => {
  const normalizedOrderId = Number(orderId);
  const order = await repository.findOrderById({ orderId: normalizedOrderId });
  if (!order) return { status: 404, body: { error: 'ไม่พบคำสั่งซื้อ' } };
  if (order.branchId !== Number(user.branchId)) {
    return {
      status: 403,
      body: { error: 'คุณไม่มีสิทธิ์ยืนยันคำสั่งซื้อของสาขาอื่น' },
    };
  }
  if (order.statusPayment === 'PAID') {
    return { status: 400, body: { error: 'คำสั่งซื้อนี้ชำระเงินแล้ว' } };
  }

  const updated = await repository.updateOrderById({
    orderId: normalizedOrderId,
    data: {
      statusPayment: 'PAID',
      paymentDate: new Date(),
      paymentSlipStatus: 'APPROVED',
      confirmedByEmployeeId: user.employeeId || null,
    },
  });

  return {
    status: 200,
    body: { message: 'อนุมัติสลิปการชำระเงินสำเร็จ', order: updated },
  };
};

const rejectOrderOnlineSlip = async ({ orderId, user = {} }) => {
  const normalizedOrderId = Number(orderId);
  const order = await repository.findOrderById({ orderId: normalizedOrderId });
  if (!order) return { status: 404, body: { error: 'ไม่พบคำสั่งซื้อ' } };
  if (order.branchId !== Number(user.branchId)) {
    return {
      status: 403,
      body: { error: 'คุณไม่มีสิทธิ์ดำเนินการกับคำสั่งซื้อของสาขาอื่น' },
    };
  }
  if (order.paymentSlipStatus !== 'WAITING_APPROVAL') {
    return {
      status: 400,
      body: { error: 'ไม่สามารถปฏิเสธสลิปในสถานะนี้ได้' },
    };
  }

  const updated = await repository.updateOrderById({
    orderId: normalizedOrderId,
    data: {
      paymentSlipStatus: 'REJECTED',
      statusPayment: 'UNPAID',
      paymentDate: null,
      confirmedByEmployeeId: null,
    },
  });

  return {
    status: 200,
    body: { message: 'ปฏิเสธสลิปเรียบร้อยแล้ว', order: updated },
  };
};

const getOrderOnlineByBranch = async ({ branchId }) => {
  const normalizedBranchId = Number(branchId);
  if (!normalizedBranchId) {
    return { status: 400, body: { error: 'branchId ไม่ถูกต้อง' } };
  }

  const orders = await repository.findOrders({
    where: { branchId: normalizedBranchId },
    mode: 'branch',
  });

  return {
    status: 200,
    body: orders.map((order) => ({
      id: order.id,
      code: order.code,
      createdAt: order.createdAt,
      status: order.status,
      paymentSlipStatus: order.paymentSlipStatus,
      statusPayment: order.statusPayment,
      customerName: order.customer?.name || order.customer?.companyName || '-',
      totalAmount: calculateOrderTotal(order.items),
    })),
  };
};

const getOrderOnlineSummary = async ({ orderId, branchId }) => {
  const normalizedOrderId = Number(orderId);
  if (!Number.isFinite(normalizedOrderId) || normalizedOrderId <= 0) {
    return { status: 400, body: { message: 'id ไม่ถูกต้อง' } };
  }

  const order = await repository.findOrderById({
    orderId: normalizedOrderId,
    branchId: Number(branchId),
    mode: 'summary',
  });
  if (!order) return { status: 404, body: { message: 'ไม่พบคำสั่งซื้อนี้' } };
  if (order.branchId !== Number(branchId)) {
    return {
      status: 403,
      body: { message: 'คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อของสาขาอื่น' },
    };
  }

  return {
    status: 200,
    body: {
      ...order,
      totalAmount: calculateOrderTotal(order.items),
      customerAddress: buildCustomerAddress(order.customer),
    },
  };
};

module.exports = {
  createOrderOnline,
  getAllOrderOnline,
  getOrderOnlineByIdForEmployee,
  approveOrderOnlineSlip,
  rejectOrderOnlineSlip,
  getOrderOnlineByBranch,
  getOrderOnlineSummary,
};
