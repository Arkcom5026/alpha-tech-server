const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const { startReadyAudit } = require('../start/startAuditController');
const { getActiveReadySession } = require('../query/active/getActiveAuditController');
const { getOverview } = require('../query/overview/getAuditOverviewController');
const { listAuditItems } = require('../query/items/listAuditItemsController');
const { scanBarcodeController, scanSerialController } = require('../scan/scanAuditController');
const { confirmAuditController, cancelAuditController } = require('../finalize/finalizeAuditController');
const {
  STOCK_AUDIT_CAPABILITY,
  allowStockAuditCapabilities,
} = require('../shared/stockAuditAuthorization');

const router = express.Router();
router.use(verifyToken);

const allowAuditAccess = allowStockAuditCapabilities(STOCK_AUDIT_CAPABILITY.ACCESS);
const allowAuditFinalize = allowStockAuditCapabilities(
  STOCK_AUDIT_CAPABILITY.ACCESS,
  STOCK_AUDIT_CAPABILITY.FINALIZE,
);

router.get('/ready/active', allowAuditAccess, getActiveReadySession);
router.post('/ready/start', allowAuditAccess, startReadyAudit);
router.get('/:sessionId/overview', allowAuditAccess, getOverview);
router.post('/:sessionId/scan', allowAuditAccess, scanBarcodeController);
router.post('/:sessionId/scan-sn', allowAuditAccess, scanSerialController);
router.post('/:sessionId/confirm', allowAuditFinalize, confirmAuditController);
router.post('/:sessionId/cancel', allowAuditFinalize, cancelAuditController);
router.get('/:sessionId/items', allowAuditAccess, listAuditItems);

module.exports = router;
