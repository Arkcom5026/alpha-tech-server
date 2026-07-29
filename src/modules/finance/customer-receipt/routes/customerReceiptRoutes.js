const express = require('express');
const router = express.Router();

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

router.get('/', searchCustomerReceipts);
router.get('/customer-search', searchCustomersForReceipt);
router.post('/', createCustomerReceipt);
router.get('/:id', getCustomerReceiptById);
router.get('/:id/allocation-candidates', searchAllocationCandidates);
router.post('/:id/allocate', allocateCustomerReceipt);
router.post('/:id/cancel', cancelCustomerReceipt);

module.exports = router;
