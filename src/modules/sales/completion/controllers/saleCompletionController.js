const { validateSaleCompletionRequest } = require('../validators/saleCompletionValidator');
const { completeSale } = require('../services/saleCompletionService');
const saleCustomerAccessService = require('../services/saleCustomerAccessService');
const { publishSaleTaxCandidate } = require('../services/publishSaleTaxCandidateService');
const {
  ensureSaleDeliveryNotePresentationSnapshot,
} = require('../../documents/presentation/ensureSaleDeliveryNotePresentationSnapshotService');
const {
  ensureSaleQuotationReference,
  resolveAcceptedQuotationReference,
} = require('../../lineage/saleQuotationReferenceService');

const completeSaleController = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const employeeId = Number(req.user?.employeeId ?? req.user?.employeeProfileId);
    if (!branchId || !employeeId) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authenticated branch and employee are required' });
    }
    const command = validateSaleCompletionRequest(req.body);
    await saleCustomerAccessService.assertAccessible({
      customerId: command.sale.customerId,
      branchId,
      employeeId,
      customerFirstAssociationToken: command.sale.customerFirstAssociationToken,
    });
    if (command.sale.sourceQuotationId) {
      await resolveAcceptedQuotationReference({
        quotationId: command.sale.sourceQuotationId,
        branchId,
        customerId: command.sale.customerId,
      });
    }

    const result = await completeSale({ command, branchId, employeeId });
    const deliveryNotePresentationRecord = command.sale.deliveryNoteMode === 'PRINT'
      ? await ensureSaleDeliveryNotePresentationSnapshot({ branchId, saleId: result.saleId })
      : null;
    const quotationReference = await ensureSaleQuotationReference({
      saleId: result.saleId,
      quotationId: command.sale.sourceQuotationId,
      branchId,
      employeeId,
    });
    const taxIntake = await publishSaleTaxCandidate({
      sale: result.sale,
      branchId,
      employeeId,
    });
    return res.status(result.idempotency.replayed ? 200 : 201).json({
      ...result,
      quotationReference,
      taxIntake,
      deliveryNotePresentation: deliveryNotePresentationRecord?.snapshot || null,
    });
  } catch (error) {
    const status = Number(error?.status || error?.statusCode) || 500;
    if (status >= 500) console.error('[sales.complete] failed', { code: error?.code, message: error?.message });
    return res.status(status).json({
      code: error?.code || 'SALE_COMPLETION_FAILED',
      message: error?.message || 'Unable to complete sale',
      ...(error?.details ? { details: error.details } : {}),
    });
  }
};

module.exports = { completeSaleController };
