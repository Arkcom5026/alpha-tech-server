const express = require('express');
const router = express.Router();
const { getSalesTaxReport } = require('../controllers/salesReportController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/sales-tax', getSalesTaxReport);

module.exports = router;
