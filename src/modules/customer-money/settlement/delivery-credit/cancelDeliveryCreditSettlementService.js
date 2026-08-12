'use strict';

const { createCustomerMoneyLedger } = require('../../ledger/createCustomerMoneyLedgerService');
const { updateCustomerMoneyBalance } = require('../../balance/updateCustomerMoneyBalanceService');
const {
  calculateAvailableCustomerMoney,
  restoreCustomerMoneySources,
} = require('../../balance/customerMoneySourcePoolService');
const {
  acquireCustomerMoneyTransactionLock,
} = require('../../shared/customerMoneyTransactionLock');
const {
  projectSalePaymentStatus,
} = require('../../../sales/completion/services/salePaymentPostingService');
const { resolveFinancialCustomerGroup } = require('../../../customer/financial-group/customerFinancialGroupResolver');
const {
  findSettlementGeneratedDocumentAnchor,
} = require('../../../finance/combined-billing/create/createSettlementConsolidatedDelivery');
const { getSettlement } = require('./deliveryCreditSettlementRepository');
const { getDeliveryCreditSettlement } = require('./queryDeliveryCreditSettlementService');

const SETTLEMENT_CANCELLATION_TRANSACTION_OPTIONS = Object.freeze({ maxWait: 10000, timeout: 30000 });

const buildError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const ensureEmployee = async (tx, branchId, employeeId) => {
  const employee = await tx.employeeProfile.findFirst({
    where: { id: employeeId, branchId, active: true, approved: true },
    select: { id: true },
  });
  if (!employee) throw buildError('ไม่พบพนักงานผู้ยกเลิกในสาขานี้', 404, 'EMPLOYEE_NOT_FOUND');
};

const ensureNoDownstreamDocumentAuthority = async (tx, { branchId, saleIds }) => {
  if (!saleIds.length || !tx?.sale?.findMany) return;
  const sales = await tx.sale.findMany({
    where: { id: { in: saleIds }, branchId },
    select: {
      id: true,
      combinedDocumentId: true,
      combinedBillingId: true,
      combinedBilling: { select: { status: true } },
    },
  });
  const blocked = sales.find((sale) => (
    sale.combinedDocumentId
    || (sale.combinedBillingId && sale.combinedBilling?.status !== 'CANCELLED')
  ));
  if (blocked) {
    throw buildError(
      'ไม่สามารถยกเลิกการตัดยอดได้ เนื่องจากใบขายที่เกี่ยวข้องถูกนำไปจัดทำเอกสารรวมแล้ว กรุณายกเลิกเอกสารปลายทางก่อน',
      409,
      'SETTLEMENT_DOWNSTREAM_DOCUMENT_EXISTS',
    );
  }
};

const ensureNoTaxDocumentAuthority = async (tx, { branchId, saleIds }) => {
  if (!saleIds.length || !tx?.taxCandidate?.findMany || !tx?.taxDocument?.findFirst) return;
  const candidates = await tx.taxCandidate.findMany({
    where: {
      branchId,
      sourceType: 'SALE',
      sourceId: { in: saleIds.map(String) },
    },
    select: { id: true, sourceId: true },
  });
  if (!candidates.length) return;

  const document = await tx.taxDocument.findFirst({
    where: {
      branchId,
      candidateId: { in: candidates.map((candidate) => candidate.id) },
      status: { notIn: ['CANCELLED', 'ARCHIVED'] },
    },
    select: {
      id: true,
      status: true,
      documentNumber: true,
      issuedDocumentNumber: true,
    },
  });
  if (document) {
    throw buildError(
      'ไม่สามารถยกเลิกการตัดยอดได้ เนื่องจากใบขายที่เกี่ยวข้องมีเอกสารภาษีแล้ว',
      409,
      'SETTLEMENT_TAX_DOCUMENT_EXISTS',
    );
  }
};

const cancelGeneratedConsolidatedDelivery = async (tx, { branchId, settlementId }) => {
  const anchor = await findSettlementGeneratedDocumentAnchor(tx, { branchId, settlementId });
  if (!anchor) return null;

  const document = await tx.combinedBillingDocument.findFirst({
    where: { id: anchor.combinedBillingId, branchId: Number(branchId) },
    select: { id: true, code: true, status: true },
  });
  if (!document) {
    throw buildError('ไม่พบใบส่งของรวมที่สร้างจากเอกสารตัดยอดนี้', 409, 'SETTLEMENT_GENERATED_DOCUMENT_MISSING');
  }
  if (document.status === 'PAID') {
    throw buildError('ไม่สามารถยกเลิกการตัดยอดได้ เนื่องจากใบส่งของรวมมีสถานะทางการเงินปลายทางแล้ว', 409, 'SETTLEMENT_GENERATED_DOCUMENT_FINALIZED');
  }

  const candidates = await tx.taxCandidate.findMany({
    where: {
      branchId: Number(branchId),
      sourceType: 'CONSOLIDATED_DELIVERY',
      sourceId: String(document.id),
    },
    select: { id: true },
  });
  if (candidates.length) {
    const taxDocument = await tx.taxDocument.findFirst({
      where: {
        branchId: Number(branchId),
        candidateId: { in: candidates.map((candidate) => candidate.id) },
        status: { notIn: ['CANCELLED', 'ARCHIVED'] },
      },
      select: { id: true, status: true, issuedDocumentNumber: true },
    });
    if (taxDocument) {
      throw buildError('ไม่สามารถยกเลิกการตัดยอดได้ เนื่องจากใบส่งของรวมถูกนำไปจัดทำเอกสารภาษีแล้ว', 409, 'SETTLEMENT_GENERATED_DOCUMENT_TAX_EXISTS');
    }
  }

  if (document.status !== 'CANCELLED') {
    await tx.consolidatedDeliveryLine.updateMany({
      where: { combinedBillingId: document.id, status: 'DOCUMENTED' },
      data: { status: 'CANCELLED' },
    });
    await tx.combinedBillingDocument.update({
      where: { id: document.id },
      data: { status: 'CANCELLED' },
    });
  }
  return document;
};

const cancelDeliveryCreditSettlement = async ({ prisma, user, id, cancelReason }) => {
  const branchId = Number(user?.branchId);
  const employeeId = Number(user?.employeeId);
  const settlementId = Number(id);
  const reason = String(cancelReason || '').trim();

  if (!Number.isInteger(branchId) || branchId <= 0) throw buildError('ไม่พบสาขาของผู้ใช้งาน', 400, 'BRANCH_CONTEXT_REQUIRED');
  if (!Number.isInteger(employeeId) || employeeId <= 0) throw buildError('ไม่พบพนักงานผู้ยกเลิก', 400, 'EMPLOYEE_CONTEXT_REQUIRED');
  if (!Number.isInteger(settlementId) || settlementId <= 0) throw buildError('รหัสเอกสารไม่ถูกต้อง', 400, 'INVALID_SETTLEMENT_ID');
  if (!reason) throw buildError('กรุณาระบุเหตุผลการยกเลิก', 400, 'CANCEL_REASON_REQUIRED');
  if (reason.length > 500) throw buildError('เหตุผลการยกเลิกยาวเกิน 500 ตัวอักษร', 400, 'CANCEL_REASON_TOO_LONG');

  return prisma.$transaction(async (tx) => {
    let settlement = await getSettlement({ client: tx, id: settlementId, branchId });
    if (!settlement) throw buildError('ไม่พบเอกสารตัดยอดใบส่งของ', 404, 'SETTLEMENT_NOT_FOUND');

    const financialGroup = await resolveFinancialCustomerGroup(tx, {
      customerId: settlement.customerId,
      branchId: settlement.branchId,
    });
    await acquireCustomerMoneyTransactionLock(tx, financialGroup.ownerId);
    await ensureEmployee(tx, branchId, employeeId);

    settlement = await getSettlement({ client: tx, id: settlementId, branchId });
    if (!settlement) throw buildError('ไม่พบเอกสารตัดยอดใบส่งของ', 404, 'SETTLEMENT_NOT_FOUND');
    if (settlement.status === 'CANCELLED') {
      throw buildError('เอกสารตัดยอดนี้ถูกยกเลิกแล้ว', 409, 'SETTLEMENT_ALREADY_CANCELLED');
    }
    if (settlement.status !== 'ACTIVE') {
      throw buildError('สถานะเอกสารนี้ไม่อนุญาตให้ยกเลิก', 409, 'SETTLEMENT_NOT_CANCELLABLE');
    }

    const saleIds = [...new Set((settlement.lines || []).map((line) => Number(line.saleId)).filter(Number.isInteger))];
    await ensureNoDownstreamDocumentAuthority(tx, { branchId, saleIds });
    await ensureNoTaxDocumentAuthority(tx, { branchId, saleIds });

    await cancelGeneratedConsolidatedDelivery(tx, { branchId, settlementId: settlement.id });

    const applications = [...new Map(
      (settlement.lines || [])
        .map((line) => line.application)
        .filter(Boolean)
        .map((application) => [application.id, application]),
    ).values()];

    await restoreCustomerMoneySources(tx, {
      branchId,
      customerId: settlement.customerId,
      applications,
      financialGroup,
    });

    const applicationIds = applications.map((application) => application.id);
    if (applicationIds.length) {
      const reversed = await tx.customerMoneyApplication.updateMany({
        where: { id: { in: applicationIds }, status: 'APPLIED' },
        data: { status: 'REVERSED' },
      });
      if (reversed.count !== applicationIds.length) {
        throw buildError('สถานะการใช้ Customer Money มีการเปลี่ยนแปลง กรุณาลองใหม่', 409, 'SETTLEMENT_APPLICATION_CONFLICT');
      }
    }

    const cancelledAt = new Date();
    await tx.customerMoneySettlement.update({
      where: { id: settlement.id },
      data: {
        status: 'CANCELLED',
        cancelledAt,
        cancelledById: employeeId,
        cancelReason: reason,
      },
    });

    for (const application of applications) {
      await createCustomerMoneyLedger({
        client: tx,
        data: {
          branchId,
          customerId: financialGroup.ownerId,
          applicationId: application.id,
          eventType: 'MONEY_APPLICATION_REVERSED',
          amount: application.amount,
          direction: 'CREDIT',
          referenceType: 'DELIVERY_CREDIT_SETTLEMENT',
          referenceId: settlement.id,
          createdById: employeeId,
        },
      });
    }

    for (const saleId of saleIds) {
      await projectSalePaymentStatus(tx, saleId);
    }

    const availableAmount = await calculateAvailableCustomerMoney(tx, {
      branchId,
      customerId: financialGroup.ownerId,
      financialGroup,
    });
    await updateCustomerMoneyBalance({
      client: tx,
      branchId,
      customerId: financialGroup.ownerId,
      availableAmount,
    });

    return getDeliveryCreditSettlement({
      prisma: tx,
      user: { ...user, branchId },
      id: settlement.id,
    });
  }, SETTLEMENT_CANCELLATION_TRANSACTION_OPTIONS);
};

module.exports = {
  cancelDeliveryCreditSettlement,
  ensureNoDownstreamDocumentAuthority,
  ensureNoTaxDocumentAuthority,
  cancelGeneratedConsolidatedDelivery,
  SETTLEMENT_CANCELLATION_TRANSACTION_OPTIONS,
};
