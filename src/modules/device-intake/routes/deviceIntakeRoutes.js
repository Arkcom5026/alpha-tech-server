const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const { createDeviceIntake } = require('../create/createDeviceIntakeController');
const {
  loadDeviceIntakeEmployeeContext,
  allowDeviceIntakeRoles,
} = require('../middlewares/deviceIntakeAuthorization');

const router = express.Router();
const INTAKE_ROLES = ['OWNER', 'MANAGER', 'CASHIER'];

router.use(verifyToken);
router.use(loadDeviceIntakeEmployeeContext);

router.post('/', allowDeviceIntakeRoles(...INTAKE_ROLES), createDeviceIntake);

module.exports = router;
