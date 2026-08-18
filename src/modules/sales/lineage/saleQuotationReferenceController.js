'use strict';

const { getSaleQuotationReference } = require('./saleQuotationReferenceService');

const getSaleQuotationReferenceController = async (req, res, next) => {
  try {
    const branchId = Number(req.user?.branchId);
    const saleId = Number(req.params.id);
    const reference = await getSaleQuotationReference({ saleId, branchId });
    return res.json({
      ok: true,
      data: reference ? {
        quotationId: reference.quotationId,
        code: reference.quotationCode,
        revisionNumber: reference.quotationRevision,
        issuedAt: reference.quotationIssuedAt,
        linkedAt: reference.createdAt,
      } : null,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ getSaleQuotationReferenceController });
