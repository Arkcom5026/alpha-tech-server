const repository = require('./orderOnlineRuntimeRepository');

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizePositiveInt = (value) => {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
};

const activeProfileRequired = () => ({
  status: 409,
  body: {
    code: 'ACTIVE_CUSTOMER_PROFILE_REQUIRED',
    error: 'ต้องระบุโปรไฟล์ลูกค้าที่กำลังใช้งาน',
  },
});

const findAuthorizedCustomerProfile = async (user = {}) => {
  const userId = normalizePositiveInt(user.id);
  const customerProfileId = normalizePositiveInt(user.customerProfileId || user.profileId);
  if (!userId || !customerProfileId) return null;

  return repository.prisma.customerProfile.findFirst({
    where: {
      id: customerProfileId,
      userId,
    },
    select: {
      id: true,
      branchId: true,
    },
  });
};

const authorizeOrderMutation = async ({ order, user = {}, action }) => {
  const profileType = String(user.profileType || '').toLowerCase();
  const branchId = normalizePositiveInt(user.branchId);

  if (profileType === 'employee' || branchId) {
    if (!branchId || order.branchId !== branchId) {
      return {
        error: {
          status: 403,
          body: { error: `คุณไม่มีสิทธิ์${action}คำสั่งซื้อของร้านอื่น` },
        },
      };
    }
    return { authority: { type: 'employee', branchId } };
  }

  const customerProfileId = normalizePositiveInt(user.customerProfileId || user.profileId);
  if (!customerProfileId) return { error: activeProfileRequired() };

  const profile = await findAuthorizedCustomerProfile(user);
  if (!profile) {
    return {
      error: {
        status: 403,
        body: {
          code: 'CUSTOMER_PROFILE_NOT_AUTHORIZED',
          error: 'ไม่มีสิทธิ์ใช้โปรไฟล์ลูกค้านี้',
        },
      },
    };
  }

  if (
    order.customerId !== profile.id
    || (profile.branchId && order.branchId !== profile.branchId)
  ) {
    return {
      error: {
        status: 403,
        body: { error: `คุณไม่มีสิทธิ์${action}คำสั่งซื้อนี้` },
      },
    };
  }

  return { authority: { type: 'customer', customerProfileId: profile.id } };
};

const updateOrderOnlineStatus = async ({ orderId, body = {}, user = {} }) => {
  const normalizedOrderId = normalizePositiveInt(orderId);
  if (!normalizedOrderId) {
    return { status: 400, body: { error: 'id ไม่ถูกต้อง' } };
  }

  const order = await repository.findOrderById({ orderId: normalizedOrderId });
  if (!order) return { status: 404, body: { error: 'ไม่พบคำสั่งซื้อ' } };

  const access = await authorizeOrderMutation({ order, user, action: 'อัปเดต' });
  if (access.error) return access.error;

  const updated = await repository.updateOrderById({
    orderId: normalizedOrderId,
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.statusPayment ? { statusPayment: body.statusPayment } : {}),
      ...(body.deliveryDate !== undefined
        ? { deliveryDate: safeDate(body.deliveryDate) }
        : {}),
      ...(body.note !== undefined ? { note: body.note ?? '' } : {}),
    },
  });

  return {
    status: 200,
    body: { message: 'อัปเดตคำสั่งซื้อสำเร็จ', order: updated },
  };
};

const deleteOrderOnline = async ({ orderId, user = {} }) => {
  const normalizedOrderId = normalizePositiveInt(orderId);
  if (!normalizedOrderId) {
    return { status: 400, body: { error: 'id ไม่ถูกต้อง' } };
  }

  const order = await repository.findOrderById({ orderId: normalizedOrderId });
  if (!order) return { status: 404, body: { error: 'ไม่พบคำสั่งซื้อ' } };

  const access = await authorizeOrderMutation({ order, user, action: 'ลบ' });
  if (access.error) return access.error;

  await repository.deleteOrderById(normalizedOrderId);
  return { status: 200, body: { message: 'ลบคำสั่งซื้อสำเร็จ' } };
};

const submitOrderOnlinePaymentSlip = async ({ orderId, body = {}, user = {} }) => {
  const normalizedOrderId = normalizePositiveInt(orderId);
  if (!normalizedOrderId) {
    return { status: 400, body: { message: 'id ไม่ถูกต้อง' } };
  }

  const order = await repository.findOrderById({ orderId: normalizedOrderId });
  if (!order) return { status: 404, body: { message: 'ไม่พบคำสั่งซื้อ' } };

  const access = await authorizeOrderMutation({ order, user, action: 'ส่งสลิปให้' });
  if (access.error) return access.error;
  if (access.authority.type !== 'customer') {
    return {
      status: 403,
      body: { error: 'เฉพาะลูกค้าเจ้าของคำสั่งซื้อเท่านั้นที่ส่งสลิปได้' },
    };
  }

  if (order.statusPayment === 'PAID') {
    return { status: 400, body: { message: 'คำสั่งซื้อนี้ชำระเงินแล้ว' } };
  }

  const imageUrl = body.slipUrl?.url || body.slipUrl || null;
  await repository.updateOrderById({
    orderId: normalizedOrderId,
    data: {
      paymentNote: body.note || '',
      paymentSlipUrl: imageUrl,
      statusPayment: 'WAITING_APPROVAL',
      paymentSlipStatus: 'WAITING_APPROVAL',
    },
  });

  return {
    status: 200,
    body: { message: 'ส่งข้อมูลการชำระเงินเรียบร้อยแล้ว กรุณารอการตรวจสอบสลิป' },
  };
};

module.exports = {
  updateOrderOnlineStatus,
  deleteOrderOnline,
  submitOrderOnlinePaymentSlip,
};
