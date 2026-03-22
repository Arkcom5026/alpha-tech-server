

// routes/salesReportRoutes.js

const express = require('express');
const router = express.Router();
const {
  getSalesTaxReport,
  getSalesDashboard,
  getSalesList,
  getProductPerformance,
  getSalesDetail,
} = require('../controllers/salesReportController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/dashboard', getSalesDashboard);
router.get('/list', getSalesList);
router.get('/product-performance', getProductPerformance);
router.get('/detail/:saleId', getSalesDetail);
router.get('/sales-tax', getSalesTaxReport);

module.exports = router;

