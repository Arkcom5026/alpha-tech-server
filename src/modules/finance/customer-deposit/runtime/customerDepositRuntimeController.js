const service = require('./customerDepositRuntimeService');

const send = (res, result) => res.status(result.status).json(result.body);

const createCustomerDeposit = async (req, res) => {
  try {
    return send(res, await service.createCustomerDeposit({
      body: req.body,
      user: req.user,
    }));
  } catch (error) {
    console.error('❌ createCustomerDeposit error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกเงินมัดจำ' });
  }
};

const getAllCustomerDeposits = async (req, res) => {
  try {
    return send(res, await service.getAllCustomerDeposits({
      branchId: req.user?.branchId,
    }));
  } catch (error) {
    console.error('❌ getAllCustomerDeposits error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
};

const getCustomerDepositById = async (req, res) => {
  try {
    return send(res, await service.getCustomerDepositById({
      id: req.params.id,
      branchId: req.user?.branchId,
    }));
  } catch (error) {
    console.error('getCustomerDepositById error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลมัดจำ' });
  }
};

const updateCustomerDeposit = async (req, res) => {
  try {
    return send(res, await service.updateCustomerDeposit({
      id: req.params.id,
      body: req.body,
      branchId: req.user?.branchId,
    }));
  } catch (error) {
    console.error('❌ updateCustomerDeposit error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลมัดจำ' });
  }
};

const deleteCustomerDeposit = async (req, res) => {
  try {
    return send(res, await service.deleteCustomerDeposit({
      id: req.params.id,
      branchId: req.user?.branchId,
    }));
  } catch (error) {
    console.error('❌ deleteCustomerDeposit error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบข้อมูลมัดจำ' });
  }
};

const getCustomerAndDepositByPhone = async (req, res) => {
  try {
    return send(res, await service.getCustomerAndDepositByPhone({
      phone: req.params.phone,
      branchId: req.user?.branchId,
    }));
  } catch (error) {
    console.error('[getCustomerAndDepositByPhone] ❌', error);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้าและมัดจำ' });
  }
};

const getCustomerAndDepositByName = async (req, res) => {
  try {
    return send(res, await service.getCustomerAndDepositByName({
      query: req.query?.q,
      branchId: req.user?.branchId,
    }));
  } catch (error) {
    console.error('[getCustomerAndDepositByName] ❌', error);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้าและมัดจำ' });
  }
};

const getCustomerAndDepositByCustomerId = async (req, res) => {
  try {
    return send(res, await service.getCustomerAndDepositByCustomerId({
      customerId: req.params.customerId,
      branchId: req.user?.branchId,
    }));
  } catch (error) {
    console.error('[getCustomerAndDepositByCustomerId] ❌', error);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้าและมัดจำ' });
  }
};

const useCustomerDeposit = async (req, res) => {
  try {
    return send(res, await service.useCustomerDeposit({
      body: req.body,
      user: req.user,
    }));
  } catch (error) {
    console.error('❌ useCustomerDeposit error:', error);
    const statusCode = Number(error?.statusCode);
    if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({
        message: error.message || 'ไม่สามารถใช้เงินมัดจำได้',
        code: error.code || 'CUSTOMER_DEPOSIT_CONFLICT',
      });
    }
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการใช้เงินมัดจำ' });
  }
};

module.exports = {
  createCustomerDeposit,
  getAllCustomerDeposits,
  getCustomerDepositById,
  updateCustomerDeposit,
  deleteCustomerDeposit,
  getCustomerAndDepositByPhone,
  getCustomerAndDepositByName,
  getCustomerAndDepositByCustomerId,
  useCustomerDeposit,
};
