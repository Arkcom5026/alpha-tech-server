'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');
const documentRepository = require('../repository/taxDocumentRepository');
const { resolveFinancialCustomerGroup } = require('../../../customer/financial-group/customerFinancialGroupResolver');

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const positiveInt = (value, code, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(code, `${field} must be a positive integer`);
  return parsed;
};

const normalizeTaxId = (value) => String(value || '').replace(/[^0-9]/g, '') || null;

const buildRegisteredAddress = (customer) => {
  const subdistrict = customer?.subdistrict || null;
  const district = subdistrict?.district || null;
  const province = district?.province || null;
  return [
    customer?.addressDetail,
    subdistrict?.nameTh ? `ต.${subdistrict.nameTh}` : null,
    district?.nameTh ? `อ.${district.nameTh}` : null,
    province?.nameTh ? `จ.${province.nameTh}` : null,
    subdistrict?.postcode,
  ].filter(Boolean).join(' ').trim() || null;
};

const resolveSourceSaleId = (document) => {
  const sourceType = String(document?.candidate?.sourceType || '').trim().toUpperCase();
  if (sourceType === 'SALE') {
    const saleId = Number(document.candidate.sourceId);
    return Number.isInteger(saleId) && saleId > 0 ? saleId : null;
  }
  if (sourceType === 'DOCUMENT_PREPARATION') {
    const saleId = Number(document?.snapshot?.sourceSaleId);
    return Number.isInteger(saleId) && saleId > 0 ? saleId : null;
  }
  return null;
};

const resolveCurrentLegalRecipient = async ({ tx, branchId, saleId }) => {
  const sale = await tx.sale.findFirst({
    where: { id: saleId, branchId },
    select: { id: true, customerId: true },
  });
  if (!sale) fail('TAX_RECIPIENT_SOURCE_SALE_NOT_FOUND', 'Source sale not found', 404);
  if (!sale.customerId) fail('TAX_RECIPIENT_CUSTOMER_REQUIRED', 'Source sale has no customer authority', 409);

  const group = await resolveFinancialCustomerGroup(tx, {
    customerId: sale.customerId,
    branchId,
  });
  const legalCustomerId = Number(group?.ownerId || sale.customerId);
  const customer = await tx.customerProfile.findFirst({
    where: { id: legalCustomerId, branchId },
    select: {
      id: true,
      name: true,
      companyName: true,
      taxId: true,
      addressDetail: true,
      subdistrict: {
        select: {
          nameTh: true,
          postcode: true,
          district: {
            select: {
              nameTh: true,
              province: { select: { nameTh: true } },
            },
          },
        },
      },
    },
  });
  if (!customer) fail('TAX_RECIPIENT_CUSTOMER_NOT_FOUND', 'Legal customer authority not found', 404);

  const legalName = String(customer.companyName || customer.name || '').trim() || null;
  const recipient = Object.freeze({
    legalName,
    taxId: normalizeTaxId(customer.taxId),
    registeredAddress: buildRegisteredAddress(customer),
    branchCode: '00000',
    isHeadOffice: true,
  });

  return Object.freeze({
    saleId: sale.id,
    selectedCustomerId: sale.customerId,
    legalCustomerId: customer.id,
    recipient,
  });
};

const refreshDraftRecipient = async ({ branchId, taxDocumentId, actorEmployeeId }) => {
  const normalizedBranchId = positiveInt(branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const normalizedDocumentId = positiveInt(taxDocumentId, 'TAX_DOCUMENT_ID_REQUIRED', 'taxDocumentId');
  const normalizedActorId = actorEmployeeId == null
    ? null
    : positiveInt(actorEmployeeId, 'TAX_RECIPIENT_REFRESH_ACTOR_INVALID', 'actorEmployeeId');

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw(Prisma.sql`
      SELECT d.*, row_to_json(c.*) AS candidate
      FROM "TaxDocument" d
      LEFT JOIN "TaxCandidate" c ON c."id" = d."candidateId"
      WHERE d."id" = ${normalizedDocumentId}
        AND d."branchId" = ${normalizedBranchId}
      LIMIT 1
      FOR UPDATE OF d
    `);
    const document = rows[0] || null;
    if (!document) fail('TAX_DOCUMENT_NOT_FOUND', 'Tax document not found', 404);
    if (document.status !== 'DRAFT' || document.documentType !== 'OUTPUT_TAX_INVOICE' || document.issuerProfileId) {
      fail('TAX_DRAFT_RECIPIENT_REFRESH_FORBIDDEN', 'Recipient may be refreshed only for an unissued draft output tax invoice', 409);
    }

    const sourceSaleId = resolveSourceSaleId(document);
    if (!sourceSaleId) {
      fail('TAX_DRAFT_RECIPIENT_SOURCE_UNSUPPORTED', 'Recipient refresh supports SALE and DOCUMENT_PREPARATION sources only', 409);
    }

    const authority = await resolveCurrentLegalRecipient({
      tx,
      branchId: normalizedBranchId,
      saleId: sourceSaleId,
    });
    const previousRecipient = document.snapshot?.recipient || null;
    const nextSnapshot = {
      ...(document.snapshot || {}),
      counterpartyName: authority.recipient.legalName,
      counterpartyTaxId: authority.recipient.taxId,
      recipient: authority.recipient,
      recipientAuthority: {
        source: 'CUSTOMER_MASTER',
        sourceSaleId,
        selectedCustomerId: authority.selectedCustomerId,
        legalCustomerId: authority.legalCustomerId,
        refreshedAt: new Date().toISOString(),
        refreshedById: normalizedActorId,
      },
    };

    const refreshed = await documentRepository.refreshDraftRecipientIdentity({
      branchId: normalizedBranchId,
      taxDocumentId: normalizedDocumentId,
      snapshot: nextSnapshot,
      counterpartyTaxId: authority.recipient.taxId,
    }, tx);
    if (!refreshed) {
      fail('TAX_DRAFT_RECIPIENT_REFRESH_CONFLICT', 'Tax document changed while recipient authority was being refreshed', 409);
    }

    await documentRepository.appendLifecycleEvent({
      taxDocumentId: normalizedDocumentId,
      fromStatus: 'DRAFT',
      toStatus: 'DRAFT',
      reason: 'Refreshed legal recipient identity from current customer authority',
      actorEmployeeId: normalizedActorId,
      metadata: {
        action: 'REFRESH_RECIPIENT',
        sourceSaleId,
        selectedCustomerId: authority.selectedCustomerId,
        legalCustomerId: authority.legalCustomerId,
        beforeRecipient: previousRecipient,
        afterRecipient: authority.recipient,
      },
    }, tx);

    return documentRepository.findDetailById({
      branchId: normalizedBranchId,
      taxDocumentId: normalizedDocumentId,
    }, tx);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
};

module.exports = Object.freeze({
  buildRegisteredAddress,
  refreshDraftRecipient,
  resolveCurrentLegalRecipient,
  resolveSourceSaleId,
});
