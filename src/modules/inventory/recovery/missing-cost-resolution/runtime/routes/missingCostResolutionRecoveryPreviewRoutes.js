const express = require('express');
const verifyToken = require('../../../../../../../middlewares/verifyToken');
const controller = require('../controller/missingCostResolutionRecoveryPreviewController');

const router = express.Router();

router.use(verifyToken);
router.get('/:resolutionId/recovery-preview', controller.getPreview);

module.exports = router;
