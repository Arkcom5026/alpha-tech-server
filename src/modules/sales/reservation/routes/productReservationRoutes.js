'use strict';

const express = require('express');
const { createProductReservationController } = require('../create/productReservationCreateController');
const {
  listProductReservationsController,
  getProductReservationByIdController,
} = require('../query/productReservationQueryController');
const { cancelProductReservationController } = require('../cancel/productReservationCancelController');
const { expireDueProductReservationsController } = require('../expiry/productReservationExpiryController');
const { convertProductReservationToSaleController } = require('../convert/productReservationConvertController');
const { markProductReservationReadyController } = require('../status/productReservationReadyController');

const router = express.Router();
router.get('/', listProductReservationsController);
router.get('/:id', getProductReservationByIdController);
router.post('/', createProductReservationController);
router.post('/expire-due', expireDueProductReservationsController);
router.post('/:id/ready-for-pickup', markProductReservationReadyController);
router.post('/:id/cancel', cancelProductReservationController);
router.post('/:id/convert-to-sale', convertProductReservationToSaleController);

module.exports = router;
