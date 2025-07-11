// routes/taxReportRoutes.js
const express = require('express');
const router = express.Router();
const { 
    getSalesTaxReport, 
    getPurchaseTaxReport 
} = require('../controllers/TaxReportController.js');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.route('/sales-tax').get(getSalesTaxReport);
               
router.route('/purchase-tax').get(getPurchaseTaxReport);

module.exports = router;