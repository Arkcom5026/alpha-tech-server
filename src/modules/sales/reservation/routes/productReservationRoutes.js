'use strict';

const express = require('express');
const { createProductReservationController } = require('../create/productReservationCreateController');
const {
  listProductReservationsController,
  getProductReservationByIdController,
} = require('../query/productReservationQueryController');
const { cancelProductReservationController } = require('../cancel/productReservationCancelController');
const { expireDueProductReservationsController } = require('../expiry/productReservationExpiryController');

const router = express.Router();
router.get('/', listProductReservationsController);
router.get('/:id', getProductReservationByIdController);
router.post('/', createProductReservationController);
router.post('/expire-due', expireDueProductReservationsController);
router.post('/:id/cancel', cancelProductReservationController);

module.exports = router;
