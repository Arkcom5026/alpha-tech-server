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
const { unifiedDocumentHistory } = require('../unifiedDocumentHistoryController');

const router = express.Router();
const documentWorkspace = require('../documentWorkspaceController');
const documentHistory = require('../documentHistoryController');
router.use(verifyToken);

router.get('/unified-document-history', unifiedDocumentHistory);
router.get('/document-workspace', documentWorkspace.list);
router.post('/document-workspace/confirm', documentWorkspace.confirm);
router.get('/consolidated-deliveries', documentHistory.list);
router.get('/consolidated-deliveries/:id/printable', documentHistory.printable);
router.get('/consolidated-deliveries/:id', documentHistory.detail);

router.get('/combinable-sales', getCombinableSales);
router.post('/create', createCombinedBillingDocument);
router.get('/combined-billing/:id', getCombinedBillingById);
router.get('/with-pending-sales', getCustomersWithPendingSales);

module.exports = router;
