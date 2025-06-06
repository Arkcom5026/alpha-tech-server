const express = require('express');
const router = express.Router();
const {
  getCustomerByPhone,
  createCustomer,
} = require('../controllers/customerController');
const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/by-phone/:phone', getCustomerByPhone);
router.post('/', createCustomer);

module.exports = router;