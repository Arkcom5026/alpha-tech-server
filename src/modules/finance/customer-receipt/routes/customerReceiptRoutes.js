const express = require('express');
const router = express.Router();

const { prisma } = require('../../../../../lib/prisma');
const { createCustomerReceipt } = require('../create/createCustomerReceiptController');
const { getCustomerReceiptById } = require('../query/detail/getCustomerReceiptByIdController');
const { searchCustomerReceipts } = require('../query/list/searchCustomerReceiptsController');
const { searchCustomersForReceipt } = require('../query/customer-search/searchCustomersForReceiptController');
const { searchAllocationCandidates } = require('../query/allocation-candidates/searchAllocationCandidatesController');
const { allocateCustomerReceipt } = require('../allocate/allocateCustomerReceiptController');
const { cancelCustomerReceipt } = require('../cancel/cancelCustomerReceiptController');

const verifyToken = require('../../../../../middlewares/verifyToken');
const { traceVerifyToken } = require('../../../../../middlewares/authTrace');
router.use(traceVerifyToken, verifyToken);

const rejectCustomerMoneyReceiveLegacyFlow = async (req, res, next) => {
  try {
    const receiptId = Number(req.params?.id);
    const branchId = Number(req.user?.branchId);
    if (!Number.isInteger(receiptId) || receiptId <= 0 || !Number.isInteger(branchId) || branchId <= 0) {
      return next();
    }

    const receipt = await prisma.customerReceipt.findFirst({
      where: { id: receiptId, branchId },
      select: { code: true },
    });

    if (receipt?.code?.startsWith('CMR-')) {
      return res.status(409).json({
        success: false,
        code: 'CUSTOMER_MONEY_RECEIVE_SEPARATE_FLOW',
        message: 'เอกสารรับเงินนี้แยกจากโฟลว์ตัดชำระเดิม กรุณาจัดการผ่านโมดูลรับเงินจากลูกค้า',
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

router.get('/', searchCustomerReceipts);
router.get('/customer-search', searchCustomersForReceipt);
router.post('/', createCustomerReceipt);
router.get('/:id', rejectCustomerMoneyReceiveLegacyFlow, getCustomerReceiptById);
router.get('/:id/allocation-candidates', rejectCustomerMoneyReceiveLegacyFlow, searchAllocationCandidates);
router.post('/:id/allocate', rejectCustomerMoneyReceiveLegacyFlow, allocateCustomerReceipt);
router.post('/:id/cancel', rejectCustomerMoneyReceiveLegacyFlow, cancelCustomerReceipt);

module.exports = router;
