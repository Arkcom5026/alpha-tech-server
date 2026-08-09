const express = require('express');

const verifyToken = require('../../../../../middlewares/verifyToken');
const { getCombinableSales } = require('../query/combinable-sales/getCombinableSalesController');
const { getCombinedBillingById } = require('../query/detail/getCombinedBillingByIdController');
const {
  getCustomersWithPendingSales,
} = require('../query/pending-customers/getCustomersWithPendingSalesController');
const {
  createCombinedBillingDocument,
} = require('../create/createCombinedBillingDocumentController');

const router = express.Router();
const documentWorkspace = require('../documentWorkspaceController');
router.use(verifyToken);

router.get('/document-workspace', documentWorkspace.list);
router.post('/document-workspace/confirm', documentWorkspace.confirm);

router.get('/combinable-sales', getCombinableSales);
router.post('/create', createCombinedBillingDocument);
router.get('/combined-billing/:id', getCombinedBillingById);
router.get('/with-pending-sales', getCustomersWithPendingSales);

module.exports = router;
