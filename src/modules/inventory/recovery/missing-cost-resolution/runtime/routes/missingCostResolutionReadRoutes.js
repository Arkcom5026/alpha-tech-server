const express = require('express');
const verifyToken = require('../../../../../../../middlewares/verifyToken');
const controller = require('../controller/missingCostResolutionReadController');

const router = express.Router();

router.use(verifyToken);
router.get('/queue', controller.listQueue);
router.get('/:resolutionId/audit-history', controller.getAuditHistory);
router.get('/:resolutionId', controller.getDetail);

module.exports = router;
