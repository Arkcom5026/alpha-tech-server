// Input-tax reporting runtime routes
const express = require('express');
const router = express.Router();

const { getInputTaxReport } = require('../../../../../../controllers/inputTaxReportController');
const verifyToken = require('../../../../../../middlewares/verifyToken');

router.use(verifyToken);
router.get('/', getInputTaxReport);

module.exports = router;
