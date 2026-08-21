'use strict';

const express = require('express');
const service = require('./taxPublicationRetryService');
const {
  TAX_PUBLICATION_RETRY_CAPABILITY,
  allowTaxPublicationRetryCapabilities,
} = require('./taxPublicationRetryAuthorization');

const router = express.Router();
const allowPublicationRetryRead = allowTaxPublicationRetryCapabilities(
  TAX_PUBLICATION_RETRY_CAPABILITY.READ,
);
const allowPublicationRetryExecute = allowTaxPublicationRetryCapabilities(
  TAX_PUBLICATION_RETRY_CAPABILITY.READ,
  TAX_PUBLICATION_RETRY_CAPABILITY.EXECUTE,
);

const context = (req) => ({
  branchId: req.user?.branchId,
  actorEmployeeId: req.user?.employeeId ?? req.user?.employeeProfileId,
});

router.get('/gaps', allowPublicationRetryRead, async (req, res, next) => {
  try {
    res.json({
      ok: true,
      data: await service.listSalePublicationGaps({
        branchId: req.user?.branchId,
        limit: req.query.limit,
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/retry-sale/:saleId', allowPublicationRetryExecute, async (req, res, next) => {
  try {
    res.json({
      ok: true,
      data: await service.retrySalePublication({
        ...context(req),
        saleId: req.params.saleId,
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/retry-all', allowPublicationRetryExecute, async (req, res, next) => {
  try {
    res.json({
      ok: true,
      data: await service.retryAllSalePublications({
        ...context(req),
        limit: req.body.limit,
      }),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
