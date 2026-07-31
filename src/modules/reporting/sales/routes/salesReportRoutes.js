// Sales reporting runtime routes
const express = require('express');
const router = express.Router();

const {
  getSalesTaxReport,
  getSalesDashboard,
  getSalesList,
  getProductPerformance,
  getSalesDetail,
} = require('../runtime/salesReportRuntimeController');

const verifyToken = require('../../../../../middlewares/verifyToken');
router.use(verifyToken);

router.get('/dashboard', getSalesDashboard);
router.get('/list', getSalesList);
router.get('/product-performance', getProductPerformance);
router.get('/detail/:saleId', getSalesDetail);
router.get('/sales-tax', getSalesTaxReport);

module.exports = router;
