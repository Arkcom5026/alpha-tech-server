'use strict';

const express = require('express');
const requireAdmin = require('../../../../middlewares/requireAdmin');
const controller = require('./storePaymentAccountController');

const router = express.Router();

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', requireAdmin, controller.create);
router.patch('/:id', requireAdmin, controller.update);

module.exports = router;
