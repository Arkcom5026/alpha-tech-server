'use strict';

const express = require('express');
const { commitController } = require('./productReservationCommitmentController');

const router = express.Router({ mergeParams: true });

router.post('/', commitController);

module.exports = router;
