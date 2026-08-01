const express = require('express');
const verifyToken = require('../../../../../../../middlewares/verifyToken');
const controller = require('../controller/missingCostResolutionRecoveryPreviewController');
const auditController = require('../controller/missingCostResolutionRecoveryAuditController');

const router = express.Router();

router.use(verifyToken);
router.get('/:resolutionId/recovery-preview', controller.getPreview);
router.get('/:resolutionId/recovery-approval-plan', controller.getApprovalPlan);
router.get('/:resolutionId/recovery-audit', auditController.getPostRecoveryAudit);

module.exports = router;
