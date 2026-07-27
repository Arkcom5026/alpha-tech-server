const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const { startReadyAudit } = require('../start/startAuditController');
const { getActiveReadySession } = require('../query/active/getActiveAuditController');
const { getOverview } = require('../query/overview/getAuditOverviewController');
const { listAuditItems } = require('../query/items/listAuditItemsController');
const {
  scanBarcode,
  scanSn,
  confirmAudit,
  cancelAudit,
} = require('../../../../../controllers/stockAuditController');

const router = express.Router();
router.use(verifyToken);

router.get('/ready/active', getActiveReadySession);
router.post('/ready/start', startReadyAudit);
router.get('/:sessionId/overview', getOverview);
router.post('/:sessionId/scan', scanBarcode);
router.post('/:sessionId/scan-sn', scanSn);
router.post('/:sessionId/confirm', confirmAudit);
router.post('/:sessionId/cancel', cancelAudit);
router.get('/:sessionId/items', listAuditItems);

module.exports = router;
