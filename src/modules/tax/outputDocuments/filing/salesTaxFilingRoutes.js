'use strict';
const express = require('express');
const service = require('./salesTaxFilingService');
const router = express.Router();
const branchId = (req) => Number(req.user?.branchId);
router.get('/', async (req, res, next) => { try { res.json({ ok: true, data: await service.listSalesTaxFilings({ branchId: branchId(req), year: req.query.year, month: req.query.month }) }); } catch (error) { next(error); } });
router.post('/prepare', async (req, res, next) => { try { res.json({ ok: true, data: await service.prepareSalesTaxFiling({ branchId: branchId(req), year: req.body.year, month: req.body.month, actorEmployeeId: req.user?.employeeId ?? req.user?.employeeProfileId }) }); } catch (error) { next(error); } });
router.post('/:batchId/submit', async (req, res, next) => { try { res.json({ ok: true, data: await service.submitSalesTaxFiling({ branchId: branchId(req), batchId: req.params.batchId }) }); } catch (error) { next(error); } });
module.exports = router;
