'use strict';

const express = require('express');
const service = require('./salesTaxFilingService');
const {
  SALES_TAX_FILING_CAPABILITY,
  allowSalesTaxFilingCapabilities,
} = require('./salesTaxFilingAuthorization');

const router = express.Router();
const branchId = (req) => Number(req.user?.branchId);

const allowRead = allowSalesTaxFilingCapabilities(SALES_TAX_FILING_CAPABILITY.READ);
const allowPrepare = allowSalesTaxFilingCapabilities(SALES_TAX_FILING_CAPABILITY.PREPARE);
const allowSubmit = allowSalesTaxFilingCapabilities(
  SALES_TAX_FILING_CAPABILITY.PREPARE,
  SALES_TAX_FILING_CAPABILITY.SUBMIT,
);

router.get('/', allowRead, async (req, res, next) => {
  try {
    res.json({
      ok: true,
      data: await service.listSalesTaxFilings({
        branchId: branchId(req),
        year: req.query.year,
        month: req.query.month,
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/prepare', allowPrepare, async (req, res, next) => {
  try {
    res.json({
      ok: true,
      data: await service.prepareSalesTaxFiling({
        branchId: branchId(req),
        year: req.body.year,
        month: req.body.month,
        actorEmployeeId: req.user?.employeeId ?? req.user?.employeeProfileId,
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:batchId/submit', allowSubmit, async (req, res, next) => {
  try {
    res.json({
      ok: true,
      data: await service.submitSalesTaxFiling({
        branchId: branchId(req),
        batchId: req.params.batchId,
      }),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
