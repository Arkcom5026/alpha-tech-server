const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const {
  loadDeviceIntakeEmployeeContext,
  allowDeviceIntakeRoles,
} = require('../../device-intake/middlewares/deviceIntakeAuthorization');
const {
  getDevicePassport,
} = require('../query/passport/devicePassportController');

const router = express.Router();
const READ_ROLES = ['OWNER', 'MANAGER', 'CASHIER'];

router.use(verifyToken);
router.use(loadDeviceIntakeEmployeeContext);

router.get(
  '/:deviceId/passport',
  allowDeviceIntakeRoles(...READ_ROLES),
  getDevicePassport
);

module.exports = router;
