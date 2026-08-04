const repository = require('./orderOnlineRuntimeRepository');

const toNum = (value) => (
  value && typeof value.toNumber === 'function'
    ? value.toNumber()
    : Number(value || 0)
);

const calculateOrderTotal = (items = []) => items.reduce(
  (sum, item) => sum + toNum(item.priceAtPurchase) * Number(item.quantity || 0),
  0
);

const buildCustomerAddress = (customer) => {
  if (!customer) return '';

  return [
    customer.addressDetail || '',
    customer.subdistrict?.nameTh ? `ต.${customer.subdistrict.nameTh}` : '',
    customer.subdistrict?.district?.nameTh
      ? `อ.${customer.subdistrict.district.nameTh}`
      : '',
    customer.subdistrict?.district?.province?.nameTh
      ? `จ.${customer.subdistrict.district.province.nameTh}`
      : '',
    customer.subdistrict?.postcode || '',
  ].filter(Boolean).join(' ');
};

const normalizeAuthority = ({ userId, customerProfileId }) => {
  const normalizedUserId = Number(userId);
  const normalizedProfileId = Number(customerProfileId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return null;
  if (!Number.isInteger(normalizedProfileId) || normalizedProfileId <= 0) return null;

  return {
    userId: normalizedUserId,
    customerProfileId: normalizedProfileId,
  };
};

const findAuthorizedProfile = ({ userId, customerProfileId }) => (
  repository.prisma.customerProfile.findFirst({
    where: {
      id: customerProfileId,
      userId,
    },
    select: {
      id: true,
      branchId: true,
    },
  })
);

const getOrderOnlineByIdForCustomer = async ({ orderId, userId, customerProfileId }) => {
  const authority = normalizeAuthority({ userId, customerProfileId });
  const normalizedOrderId = Number(orderId);

  if (!Number.isInteger(normalizedOrderId) || normalizedOrderId <= 0) {
    return { status: 400, body: { error: 'id ไม่ถูกต้อง' } };
  }
  if (!authority) {
    return {
      status: 409,
      body: {
        code: 'ACTIVE_CUSTOMER_PROFILE_REQUIRED',
        error: 'ต้องระบุโปรไฟล์ลูกค้าที่กำลังใช้งาน',
      },
    };
  }

  const profile = await findAuthorizedProfile(authority);
  if (!profile) {
    return {
      status: 403,
      body: { code: 'CUSTOMER_PROFILE_NOT_AUTHORIZED', error: 'ไม่มีสิทธิ์ใช้โปรไฟล์ลูกค้านี้' },
    };
  }

  const order = await repository.findOrderById({
    orderId: normalizedOrderId,
    mode: 'detail',
  });

  if (
    !order
    || order.customerId !== profile.id
    || (profile.branchId && order.branchId !== profile.branchId)
  ) {
    return { status: 403, body: { error: 'คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้' } };
  }

  return {
    status: 200,
    body: {
      id: order.id,
      code: order.code,
      status: order.status,
      statusPayment: order.statusPayment,
      paymentSlipStatus: order.paymentSlipStatus,
      paymentMethod: order.paymentMethod,
      deliveryDate: order.deliveryDate,
      createdAt: order.createdAt,
      totalAmount: calculateOrderTotal(order.items),
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
    },
  };
};

const getOrderOnlineByCustomer = async ({ userId, customerProfileId, status }) => {
  const authority = normalizeAuthority({ userId, customerProfileId });
  if (!authority) {
    return {
      status: 409,
      body: {
        code: 'ACTIVE_CUSTOMER_PROFILE_REQUIRED',
        error: 'ต้องระบุโปรไฟล์ลูกค้าที่กำลังใช้งาน',
      },
    };
  }

  const profile = await findAuthorizedProfile(authority);
  if (!profile) {
    return {
      status: 403,
      body: { code: 'CUSTOMER_PROFILE_NOT_AUTHORIZED', error: 'ไม่มีสิทธิ์ใช้โปรไฟล์ลูกค้านี้' },
    };
  }

  const orders = await repository.findOrders({
    where: {
      customerId: profile.id,
      ...(profile.branchId ? { branchId: profile.branchId } : {}),
      ...(status && status !== 'ALL' ? { status } : {}),
    },
    mode: 'customer',
  });

  return {
    status: 200,
    body: orders.map((order) => ({
      ...order,
      totalAmount: calculateOrderTotal(order.items),
      paymentStatusLabel:
        order.statusPayment === 'PAID' ? 'ชำระแล้ว' : 'ยังไม่ชำระ',
    })),
  };
};

module.exports = {
  getOrderOnlineByIdForCustomer,
  getOrderOnlineByCustomer,
};
