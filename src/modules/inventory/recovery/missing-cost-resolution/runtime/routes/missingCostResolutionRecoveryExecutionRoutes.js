const express = require('express');
const verifyToken = require('../../../../../../../middlewares/verifyToken');
const controller = require('../controller/missingCostResolutionRecoveryExecutionController');

const router = express.Router();

router.use(verifyToken);
router.post('/:resolutionId/recovery-execution', controller.executeRecovery);

module.exports = router;
