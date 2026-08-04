const service = require('./orderOnlineRuntimeService');
const customerAuthorityService = require('./orderOnlineCustomerAuthorityService');

const send = (res, result) => res.status(result.status).json(result.body);

const createOrderOnline = async (req, res) => {
  try {
    return send(res, await service.createOrderOnline({
      body: req.body || {},
      user: req.user || {},
    }));
  } catch (error) {
    console.error('❌ createOrderOnline error:', error);
    console.error('📦 req.body:', req.body);
    return res.status(500).json({ error: 'ไม่สามารถสร้างคำสั่งซื้อได้' });
  }
};

const getAllOrderOnline = async (req, res) => {
  try {
    return send(res, await service.getAllOrderOnline({
      branchId: req.user?.branchId,
      status: req.query?.status,
    }));
  } catch (error) {
    console.error('❌ getAllOrderOnline error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้' });
  }
};

const getOrderOnlineByIdForEmployee = async (req, res) => {
  try {
    return send(res, await service.getOrderOnlineByIdForEmployee({
      orderId: req.params?.id,
      branchId: req.user?.branchId,
    }));
  } catch (error) {
    console.error('❌ getOrderOnlineByIdForEmployee error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้' });
  }
};

const getOrderOnlineByIdForCustomer = async (req, res) => {
  try {
    return send(res, await customerAuthorityService.getOrderOnlineByIdForCustomer({
      orderId: req.params?.id,
      userId: req.user?.id,
      customerProfileId: req.user?.customerProfileId,
    }));
  } catch (error) {
    console.error('❌ getOrderOnlineByIdForCustomer error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้' });
  }
};

const updateOrderOnlineStatus = async (req, res) => {
  try {
    return send(res, await service.updateOrderOnlineStatus({
      orderId: req.params?.id,
      body: req.body || {},
      user: req.user || {},
    }));
  } catch (error) {
    console.error('❌ updateOrderOnlineStatus error:', error);
    return res.status(500).json({ error: 'ไม่สามารถอัปเดตคำสั่งซื้อได้' });
  }
};

const deleteOrderOnline = async (req, res) => {
  try {
    return send(res, await service.deleteOrderOnline({
      orderId: req.params?.id,
      user: req.user || {},
    }));
  } catch (error) {
    console.error('❌ deleteOrderOnline error:', error);
    return res.status(500).json({ error: 'ไม่สามารถลบคำสั่งซื้อได้' });
  }
};

const getOrderOnlineByCustomer = async (req, res) => {
  try {
    return send(res, await customerAuthorityService.getOrderOnlineByCustomer({
      userId: req.user?.id,
      customerProfileId: req.user?.customerProfileId,
      status: req.query?.status,
    }));
  } catch (error) {
    console.error('❌ getOrderOnlineByCustomer error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงคำสั่งซื้อของคุณได้' });
  }
};

const submitOrderOnlinePaymentSlip = async (req, res) => {
  try {
    return send(res, await service.submitOrderOnlinePaymentSlip({
      orderId: req.params?.orderId,
      body: req.body || {},
    }));
  } catch (error) {
    console.error('submitOrderOnlinePaymentSlip error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการส่งข้อมูลการชำระเงิน' });
  }
};

const approveOrderOnlineSlip = async (req, res) => {
  try {
    return send(res, await service.approveOrderOnlineSlip({
      orderId: req.params?.id,
      user: req.user || {},
    }));
  } catch (error) {
    console.error('❌ approveOrderOnlineSlip error:', error);
    return res.status(500).json({ error: 'ไม่สามารถอนุมัติการชำระเงินได้' });
  }
};

const rejectOrderOnlineSlip = async (req, res) => {
  try {
    return send(res, await service.rejectOrderOnlineSlip({
      orderId: req.params?.id,
      user: req.user || {},
    }));
  } catch (error) {
    console.error('❌ rejectOrderOnlineSlip error:', error);
    return res.status(500).json({ error: 'ไม่สามารถปฏิเสธสลิปได้' });
  }
};

const getOrderOnlineByBranch = async (req, res) => {
  try {
    return send(res, await service.getOrderOnlineByBranch({
      branchId: req.user?.branchId,
    }));
  } catch (error) {
    console.error('❌ getOrderOnlineByBranch error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงคำสั่งซื้อได้' });
  }
};

const getOrderOnlineSummary = async (req, res) => {
  try {
    return send(res, await service.getOrderOnlineSummary({
      orderId: req.params?.id,
      branchId: req.user?.branchId,
    }));
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
  getOrderOnlineByCustomer,
  submitOrderOnlinePaymentSlip,
  approveOrderOnlineSlip,
  rejectOrderOnlineSlip,
  getOrderOnlineByBranch,
  getOrderOnlineSummary,
};
