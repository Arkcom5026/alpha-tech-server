const express = require('express');
const verifyToken = require('../../../../../../../middlewares/verifyToken');
const controller = require('../controller/missingCostResolutionMutationController');

const router = express.Router();

router.use(verifyToken);
router.post('/', controller.createDraft);
router.post('/:resolutionId/evidence-versions', controller.appendEvidence);
router.post('/:resolutionId/transitions', controller.transition);

module.exports = router;
