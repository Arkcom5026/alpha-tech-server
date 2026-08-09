'use strict';
const express = require('express'); const service = require('./taxPublicationRetryService'); const router = express.Router();
const context = (req) => ({ branchId: req.user?.branchId, actorEmployeeId: req.user?.employeeId ?? req.user?.employeeProfileId });
router.get('/gaps', async (req, res, next) => { try { res.json({ ok: true, data: await service.listSalePublicationGaps({ branchId: req.user?.branchId, limit: req.query.limit }) }); } catch (e) { next(e); } });
router.post('/retry-sale/:saleId', async (req, res, next) => { try { res.json({ ok: true, data: await service.retrySalePublication({ ...context(req), saleId: req.params.saleId }) }); } catch (e) { next(e); } });
router.post('/retry-all', async (req, res, next) => { try { res.json({ ok: true, data: await service.retryAllSalePublications({ ...context(req), limit: req.body.limit }) }); } catch (e) { next(e); } });
module.exports = router;
