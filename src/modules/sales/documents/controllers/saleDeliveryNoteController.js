'use strict';

const { projectSaleDeliveryNote } = require('../print/projectSaleDeliveryNoteService');

const getSaleDeliveryNote = async (req, res, next) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!Number.isInteger(branchId) || branchId <= 0) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authenticated branch is required' });
    }

    const result = await projectSaleDeliveryNote({
      branchId,
      saleId: req.params.id,
    });

    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ getSaleDeliveryNote });
