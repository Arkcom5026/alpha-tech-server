'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { registerTaxCandidate } = require('../../intake/registerTaxCandidateService');
const { assertSaleTaxDocumentEligibility } = require('./saleTaxDocumentEligibilityPolicy');
const { resolveFinancialCustomerGroup } = require('../../../customer/financial-group/customerFinancialGroupResolver');

const registerSaleTaxCandidate = async ({ branchId, saleId, actorEmployeeId }) => {
  const normalizedBranchId = Number(branchId);
  const normalizedSaleId = Number(saleId);

  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    throw Object.assign(new Error('branchId must be a positive integer'), { code: 'TAX_BRANCH_REQUIRED', statusCode: 400 });
  }
  if (!Number.isInteger(normalizedSaleId) || normalizedSaleId <= 0) {
    throw Object.assign(new Error('saleId must be a positive integer'), { code: 'TAX_SALE_ID_REQUIRED', statusCode: 400 });
  }

  const sale = await prisma.sale.findFirst({
    where: { id: normalizedSaleId, branchId: normalizedBranchId },
    select: {
      id: true,
      code: true,
      branchId: true,
      customerId: true,
      totalBeforeDiscount: true,
      totalDiscount: true,
      totalAmount: true,
      vat: true,
      vatRate: true,
      isTaxInvoice: true,
      status: true,
      statusPayment: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          name: true,
          companyName: true,
          departmentName: true,
          taxId: true,
          type: true,
          addressDetail: true,
          subdistrict: { select: { nameTh: true, district: { select: { nameTh: true, province: { select: { nameTh: true } } } } } },
        },
      },
      items: {
        select: {
          id: true, basePrice: true, discount: true, price: true, vatAmount: true,
          documentDescription: true,
          stockItem: { select: { barcode: true, product: { select: { name: true } } } },
        },
      },
      simpleItems: {
        select: {
          id: true, quantity: true, basePrice: true, discount: true, price: true, vatAmount: true,
          documentDescription: true, product: { select: { name: true } },
        },
      },
    },
  });

  if (!sale) {
    throw Object.assign(new Error('Sale not found'), { code: 'TAX_SOURCE_SALE_NOT_FOUND', statusCode: 404 });
  }
  if (!['COMPLETED', 'FINALIZED', 'DELIVERED'].includes(String(sale.status || '').toUpperCase())) {
    throw Object.assign(new Error('Sale is not ready for tax intake'), {
      code: 'TAX_SOURCE_SALE_NOT_READY',
      statusCode: 409,
    });
  }

  assertSaleTaxDocumentEligibility(sale);
  const group = sale.customerId
    ? await resolveFinancialCustomerGroup(prisma, { customerId: sale.customerId, branchId: normalizedBranchId })
    : null;
  const legalCustomer = group?.ownerId && group.ownerId !== sale.customerId
    ? await prisma.customerProfile.findFirst({
        where: { id: group.ownerId, branchId: normalizedBranchId },
        select: {
          id: true, name: true, companyName: true, taxId: true, type: true, addressDetail: true,
          subdistrict: { select: { nameTh: true, district: { select: { nameTh: true, province: { select: { nameTh: true } } } } } },
        },
      })
    : sale.customer;

  const gross = Number(sale.totalAmount || 0);
  const taxAmount = Number(sale.vat || 0);
  const subtotalAmount = Math.max(0, gross - taxAmount);
  const customerAddress = [
    legalCustomer?.addressDetail,
    legalCustomer?.subdistrict?.nameTh,
    legalCustomer?.subdistrict?.district?.nameTh,
    legalCustomer?.subdistrict?.district?.province?.nameTh,
  ].filter(Boolean).join(' ');
  const items = [
    ...sale.items.map((item) => ({
      id: `STOCK:${item.id}`,
      sourceLineType: 'STOCK',
      sourceLineId: item.id,
      description: item.documentDescription || item.stockItem?.product?.name || 'Sale item',
      barcode: item.stockItem?.barcode || null,
      quantity: 1,
      unitAmount: Number(item.basePrice || 0),
      discountAmount: Number(item.discount || 0),
      lineAmount: Number(item.price || 0),
      vatAmount: Number(item.vatAmount || 0),
    })),
    ...sale.simpleItems.map((item) => ({
      id: `SIMPLE:${item.id}`,
      sourceLineType: 'SIMPLE',
      sourceLineId: item.id,
      description: item.documentDescription || item.product?.name || 'Sale item',
      barcode: null,
      quantity: Number(item.quantity || 0),
      unitAmount: Number(item.basePrice || 0),
      discountAmount: Number(item.discount || 0),
      lineAmount: Number(item.price || 0),
      vatAmount: Number(item.vatAmount || 0),
    })),
  ];

  return registerTaxCandidate({
    branchId: normalizedBranchId,
    sourceType: 'SALE',
    sourceId: String(sale.id),
    sourceDocumentNo: sale.code,
    occurredAt: sale.updatedAt || sale.createdAt,
    actorEmployeeId,
    snapshot: {
      saleId: sale.id,
      saleCode: sale.code,
      customerId: sale.customerId,
      financialOwnerCustomerId: group?.ownerId || sale.customerId,
      sourceDepartmentName: sale.customer?.departmentName || null,
      counterpartyName: legalCustomer?.companyName || legalCustomer?.name || null,
      counterpartyTaxId: legalCustomer?.taxId || null,
      recipient: {
        legalName: legalCustomer?.companyName || legalCustomer?.name || null,
        taxId: legalCustomer?.taxId || null,
        registeredAddress: customerAddress || null,
        branchCode: '00000',
        isHeadOffice: true,
      },
      customerType: legalCustomer?.type || null,
      isTaxInvoice: Boolean(sale.isTaxInvoice),
      saleStatus: sale.status,
      paymentStatus: sale.statusPayment,
      subtotalAmount,
      discountAmount: Number(sale.totalDiscount || 0),
      taxAmount,
      totalAmount: gross,
      vatRate: Number(sale.vatRate || 0),
      currency: 'THB',
      issuedAt: sale.updatedAt || sale.createdAt,
      items,
    },
  });
};

module.exports = Object.freeze({ registerSaleTaxCandidate });
