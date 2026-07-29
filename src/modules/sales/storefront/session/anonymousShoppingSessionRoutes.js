'use strict';

const express = require('express');
const {
  createController,
  getController,
  setItemController,
  removeItemController,
  abandonController,
} = require('./anonymousShoppingSessionController');

const router = express.Router({ mergeParams: true });

router.post('/', createController);
router.get('/', getController);
router.put('/items/:productId', setItemController);
router.delete('/items/:productId', removeItemController);
router.delete('/', abandonController);

module.exports = router;
