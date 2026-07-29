const express = require('express');
const router = express.Router();

const {
  getCustomerByPhone,
  getCustomerByName,
  searchStoreCustomers,
  getCustomerByUserId,
} = require('../controllers/customerQueryController');
const { createCustomer } = require('../controllers/customerCreateController');
const {
  updateCustomerProfile,
  updateCustomerProfileOnline,
} = require('../controllers/customerUpdateController');

const verifyToken = require('../../../../middlewares/verifyToken');
router.use(verifyToken);

router.get('/search', searchStoreCustomers);
router.get('/by-phone/:phone', getCustomerByPhone);
router.get('/by-name', getCustomerByName);
router.get('/me', getCustomerByUserId);

router.post('/', createCustomer);
router.put('/me', updateCustomerProfileOnline);
router.put('/:id', updateCustomerProfile);

module.exports = router;
