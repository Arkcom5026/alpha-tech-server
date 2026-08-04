const express = require('express');
const verifyToken = require('../../../middlewares/verifyToken');
const controller = require('./overview/platformCustomerOverviewController');

const router = express.Router();
router.use(verifyToken);
router.get('/overview', controller.getOverview);

module.exports = router;
