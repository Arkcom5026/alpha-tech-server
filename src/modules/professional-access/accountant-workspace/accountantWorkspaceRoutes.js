const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./accountantWorkspaceController');

const router = express.Router();
router.use(verifyToken);

router.get(
  '/organizations/:externalOrganizationId/businesses',
  controller.listBusinesses,
);
router.get(
  '/organizations/:externalOrganizationId/businesses/:businessId',
  controller.getBusinessWorkspace,
);

module.exports = router;
