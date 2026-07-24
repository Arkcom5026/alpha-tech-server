const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const repairController = require('../controllers/repairController');

const router = express.Router();

router.use(verifyToken);

router.get('/intake-context/:lookup', repairController.getIntakeContext);

router.get('/jobs', repairController.listJobs);

router.get('/jobs/:id', repairController.getJob);

router.post('/jobs', repairController.createJob);

router.patch('/jobs/:id/status', repairController.updateStatus);

router.post('/jobs/:id/parts', repairController.addParts);

router.post(
  '/jobs/:id/warranty-claims',
  repairController.openWarrantyClaim
);

router.get(
  '/warranty-claims',
  repairController.listWarrantyClaims
);

router.get(
  '/warranty-claims/:claimId',
  repairController.getWarrantyClaim
);

router.patch(
  '/warranty-claims/:claimId/status',
  repairController.updateWarrantyClaimStatus
);

module.exports = router;
