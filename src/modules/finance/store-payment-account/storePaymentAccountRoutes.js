'use strict';

const express = require('express');
const controller = require('./storePaymentAccountController');
const {
  requireStorePaymentAccountRead,
  requireStorePaymentAccountManage,
} = require('./storePaymentAccountAuthorization');

const router = express.Router();

router.get('/', requireStorePaymentAccountRead, controller.list);
router.get('/:id', requireStorePaymentAccountRead, controller.get);
router.post('/', requireStorePaymentAccountManage, controller.create);
router.patch('/:id', requireStorePaymentAccountManage, controller.update);

module.exports = router;
