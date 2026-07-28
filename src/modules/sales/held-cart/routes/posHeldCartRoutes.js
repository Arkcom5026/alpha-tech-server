'use strict';

const express = require('express');
const controller = require('../controllers/posHeldCartController');

const router = express.Router();
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:heldCartId', controller.detail);
router.put('/:heldCartId', controller.update);
router.post('/:heldCartId/revalidate', controller.revalidate);
router.post('/:heldCartId/cancel', controller.cancel);

module.exports = router;
