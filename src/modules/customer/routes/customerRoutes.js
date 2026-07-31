const express = require('express');
const router = express.Router();

const customerByPhoneController = require('../query/by-phone/customerByPhoneController');
const customerByNameController = require('../query/by-name/customerByNameController');
const customerSelfController = require('../query/self/customerSelfController');
const { createCustomer } = require('../controllers/customerCreateController');
const {
  updateCustomerProfile,
  updateCustomerProfileOnline,
} = require('../controllers/customerUpdateController');

const verifyToken = require('../../../../middlewares/verifyToken');
router.use(verifyToken);

router.get('/by-phone/:phone', customerByPhoneController.getCustomerByPhone);
router.get('/by-name', customerByNameController.getCustomerByName);
router.get('/me', customerSelfController.getCustomerSelf);

router.post('/', createCustomer);
router.put('/me', updateCustomerProfileOnline);
router.put('/:id', updateCustomerProfile);

module.exports = router;
