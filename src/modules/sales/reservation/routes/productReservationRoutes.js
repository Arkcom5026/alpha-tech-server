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
const {
  markProductReservationReadyToShipController,
  markProductReservationShippingController,
  markProductReservationDeliveredController,
} = require('../status/productReservationDeliveryStatusController');
const {
  getPartnerStoreCapabilityController,
  savePartnerStoreCapabilityController,
} = require('../store-capability/partnerStoreCapabilityController');

const router = express.Router();
router.get('/', listProductReservationsController);
router.post('/', createProductReservationController);
router.post('/expire-due', expireDueProductReservationsController);
router.get('/store-capability', getPartnerStoreCapabilityController);
router.put('/store-capability', savePartnerStoreCapabilityController);
router.get('/:id', getProductReservationByIdController);
router.post('/:id/ready-for-pickup', markProductReservationReadyController);
router.post('/:id/ready-to-ship', markProductReservationReadyToShipController);
router.post('/:id/shipping', markProductReservationShippingController);
router.post('/:id/delivered', markProductReservationDeliveredController);
router.post('/:id/cancel', cancelProductReservationController);
router.post('/:id/convert-to-sale', convertProductReservationToSaleController);

module.exports = router;
