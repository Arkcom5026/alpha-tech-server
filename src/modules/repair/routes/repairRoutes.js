const express = require('express');
const repairController = require('../controllers/repairController');
const {
  protect,
  restrictTo,
} = require('../../../middlewares/authGuard');

const router = express.Router();

router.use(protect);

router.get(
  '/intake-context/:lookup',
  restrictTo('MANAGER', 'CASHIER', 'TECHNICIAN'),
  repairController.getIntakeContext
);

router.get(
  '/jobs',
  restrictTo('MANAGER', 'CASHIER', 'TECHNICIAN'),
  repairController.listJobs
);

router.get(
  '/jobs/:id',
  restrictTo('MANAGER', 'CASHIER', 'TECHNICIAN'),
  repairController.getJob
);

router.post(
  '/jobs',
  restrictTo('MANAGER', 'CASHIER', 'TECHNICIAN'),
  repairController.createJob
);

router.patch(
  '/jobs/:id/status',
  restrictTo('MANAGER', 'TECHNICIAN'),
  repairController.updateStatus
);

router.post(
  '/jobs/:id/parts',
  restrictTo('MANAGER', 'TECHNICIAN'),
  repairController.addParts
);

router.post(
  '/jobs/:id/warranty-claims',
  restrictTo('MANAGER', 'CASHIER', 'TECHNICIAN'),
  repairController.openWarrantyClaim
);

router.get(
  '/warranty-claims',
  restrictTo('MANAGER', 'CASHIER', 'TECHNICIAN'),
  repairController.listWarrantyClaims
);

router.get(
  '/warranty-claims/:claimId',
  restrictTo('MANAGER', 'CASHIER', 'TECHNICIAN'),
  repairController.getWarrantyClaim
);

router.patch(
  '/warranty-claims/:claimId/status',
  restrictTo('MANAGER', 'TECHNICIAN'),
  repairController.updateWarrantyClaimStatus
);

module.exports = router;
