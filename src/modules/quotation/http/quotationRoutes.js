'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const service = require('../quotationService');

const router = express.Router();
router.use(verifyToken);

const context = (req) => ({
  branchId: Number(req.user?.branchId || req.user?.employeeBranchId || 0),
  employeeId: Number(req.user?.employeeId || req.user?.employeeProfileId || 0),
});

const handle = (operation, status = 200) => async (req, res, next) => {
  try {
    const data = await operation(req);
    return res.status(status).json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

router.get('/', handle((req) => service.list({ ...req.query, ...context(req) })));
router.post('/', handle((req) => service.create({ ...req.body, ...context(req) }), 201));
router.get('/:quotationId', handle((req) => service.detail({ quotationId: req.params.quotationId, ...context(req) })));
router.put('/:quotationId', handle((req) => service.updateDraft({ ...req.body, quotationId: req.params.quotationId, ...context(req) })));
router.post('/:quotationId/items', handle((req) => service.addLine({ ...req.body, quotationId: req.params.quotationId, ...context(req) }), 201));
router.put('/:quotationId/items/:lineId', handle((req) => service.updateLine({ ...req.body, quotationId: req.params.quotationId, lineId: req.params.lineId, ...context(req) })));
router.delete('/:quotationId/items/:lineId', handle((req) => service.removeLine({ quotationId: req.params.quotationId, lineId: req.params.lineId, ...context(req) })));
router.post('/:quotationId/issue', handle((req) => service.issue({ ...req.body, quotationId: req.params.quotationId, ...context(req) })));
router.post('/:quotationId/accept', handle((req) => service.accept({ ...req.body, quotationId: req.params.quotationId, ...context(req) })));
router.post('/:quotationId/reject', handle((req) => service.reject({ ...req.body, quotationId: req.params.quotationId, ...context(req) })));
router.post('/:quotationId/cancel', handle((req) => service.cancel({ ...req.body, quotationId: req.params.quotationId, ...context(req) })));

module.exports = router;