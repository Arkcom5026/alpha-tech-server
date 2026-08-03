const express = require('express');
const router = express.Router();

const customerSearchController = require('../query/search/customerSearchController');
const customerByPhoneController = require('../query/by-phone/customerByPhoneController');
const customerByNameController = require('../query/by-name/customerByNameController');
const customerSelfController = require('../query/self/customerSelfController');
const customerCreateController = require('../create/customerCreateController');
const customerStaffUpdateController = require('../update/staff/customerStaffUpdateController');
const customerSelfUpdateController = require('../update/self/customerSelfUpdateController');

const verifyToken = require('../../../../middlewares/verifyToken');
router.use(verifyToken);

router.get('/search', customerSearchController.searchCustomers);
router.get('/by-phone/:phone', customerByPhoneController.getCustomerByPhone);
router.get('/by-name', customerByNameController.getCustomerByName);
router.get('/me', customerSelfController.getCustomerSelf);

router.post('/', customerCreateController.createCustomer);
router.put('/me', customerSelfUpdateController.updateCustomerSelf);
router.put('/:id', customerStaffUpdateController.updateCustomerStaff);

module.exports = router;
