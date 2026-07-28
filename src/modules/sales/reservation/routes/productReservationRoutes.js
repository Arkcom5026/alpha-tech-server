'use strict';

const express = require('express');
const { createProductReservationController } = require('../create/productReservationCreateController');

const router = express.Router();
router.post('/', createProductReservationController);

module.exports = router;