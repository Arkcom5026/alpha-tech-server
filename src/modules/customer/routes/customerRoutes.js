const express = require('express');
const router = express.Router();

const customerByPhoneController = require('../query/by-phone/customerByPhoneController');
const customerByNameController = require('../query/by-name/customerByNameController');
const customerSelfController = require('../query/self/customerSelfController');
const customerCreateController = require('../create/customerCreateController');
const customerStaffUpdateController = require('../update/staff/customerStaffUpdateController');
const { updateCustomerProfileOnline } = require('../controllers/customerUpdateController');

const verifyToken = require('../../../../middlewares/verifyToken');
router.use(verifyToken);

router.get('/by-phone/:phone', customerByPhoneController.getCustomerByPhone);
router.get('/by-name', customerByNameController.getCustomerByName);
router.get('/me', customerSelfController.getCustomerSelf);

router.post('/', customerCreateController.createCustomer);
router.put('/me', updateCustomerProfileOnline);
router.put('/:id', customerStaffUpdateController.updateCustomerStaff);

module.exports = router;
