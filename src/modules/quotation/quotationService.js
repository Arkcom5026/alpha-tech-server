'use strict';

const crypto = require('crypto');
const { prisma } = require('../../../lib/prisma');
const contract = require('./quotationContract');
const { customerFields } = require('./quotationCustomerSnapshot');
const { buildIssuedSnapshot } = require('./quotationIssuedSnapshot');

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const actor = (input) => ({
  branchId: contract.positiveInt(input.branchId, 'branchId'),
  employeeId: contract.positiveInt(input.employeeId, 'employeeId'),
});

const ensureActorAuthority = async ({ branchId, employeeId }, tx = prisma) => {
  const employee = await tx.employeeProfile.findFirst({
    where: { id: employeeId, branchId, active: true, approved: true },
    select: { id: true },
  });
  if (!employee) contract.fail('Employee is not authorized for this branch', 'QUOTATION_BRANCH_AUTHORITY_FAILED', 403);
};

const loadCustomerSnapshot = async ({ customerId, branchId }, tx = prisma) => {
  if (!customerId) return null;
  const customer = await tx.customerProfile.findFirst({
    where: { id: customerId, branchId },
    select: {
      id: true,
      name: true,
      companyName: true,
      departmentName: true,
      taxId: true,
      addressDetail: true,
      subdistrictCode: true,
      paymentTerms: true,
      user: { select: { loginId: true, email: true } },
    },
  });
  if (!customer) contract.fail('Customer does not belong to this branch', 'QUOTATION_CUSTOMER_SCOPE_FAILED', 404);

  const subdistrict = customer.subdistrictCode
    ? await tx.subdistrict.findUnique({
      where: { code: customer.subdistrictCode },
      select: {
        code: true,
        nameTh: true,
        postcode: true,
        district: {
          select: {
            code: true,
            nameTh: true,
            province: { select: { code: true, nameTh: true } },
          },
        },
      },
    })
    : null;

  return { ...customer, subdistrict };
};

const quotationInclude = Object.freeze({
  items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  events: { orderBy: { createdAt: 'desc' }, take: 30 },
});

const ensureQuotation = async ({ quotationId, branchId }, tx = prisma) => {
  const row = await tx.quotation.findFirst({
    where: { id: contract.positiveInt(quotationId, 'quotationId'), branchId },
    include: quotationInclude,
  });
  if (!row) contract.fail('Quotation not found', 'QUOTATION_NOT_FOUND', 404);
  return row;
};

const ensureDraft = (quotation) => {
  if (quotation.status !== 'DRAFT') {
    contract.fail('Only draft quotations can be edited', 'QUOTATION_NOT_EDITABLE', 409);
  }
};

const ensureIssuable = (quotation) => {
  ensureDraft(quotation);
  if (!(quotation.customerCompany || quotation.customerName)) {
    contract.fail('Quotation recipient is required before issue', 'QUOTATION_ISSUE_CUSTOMER_REQUIRED', 409);
  }
  if (!quotation.items?.length) {
    contract.fail('Quotation must contain at least one line before issue', 'QUOTATION_ISSUE_LINE_REQUIRED', 409);
  }
};

const recalculate = async ({ quotationId, branchId }, tx) => {
  const quotation = await tx.quotation.findFirst({ where: { id: quotationId, branchId } });
  if (!quotation) contract.fail('Quotation not found', 'QUOTATION_NOT_FOUND', 404);
  const items = await tx.quotationItem.findMany({ where: { quotationId } });
  const subtotal = money(items.reduce((sum, item) => sum + Number(item.lineSubtotal || 0), 0));
  const lineDiscountTotal = money(items.reduce((sum, item) => sum + Number(item.discountAmount || 0), 0));
  const afterLineDiscount = Math.max(0, money(subtotal - lineDiscountTotal));
  const billDiscount = Math.min(afterLineDiscount, money(quotation.billDiscount));
  const taxable = Math.max(0, money(afterLineDiscount - billDiscount));
  const vatRate = money(quotation.vatRate);
  const vatAmount = quotation.vatEnabled ? money(taxable * vatRate / 100) : 0;
  const grandTotal = money(taxable + vatAmount);
  return tx.quotation.update({
    where: { id: quotationId },
    data: { subtotal, lineDiscountTotal, billDiscount, vatAmount, grandTotal },
    include: quotationInclude,
  });
};

const create = async (input) => {
  const authority = actor(input);
  return prisma.$transaction(async (tx) => {
    await ensureActorAuthority(authority, tx);
    const customerId = contract.optionalPositiveInt(input.customerId, 'customerId');
    const snapshot = await loadCustomerSnapshot({ customerId, branchId: authority.branchId }, tx);
    const temporaryCode = `QT-PENDING-${authority.branchId}-${crypto.randomUUID()}`;
    const created = await tx.quotation.create({
      data: {
        code: temporaryCode,
        branchId: authority.branchId,
        customerId,
        createdById: authority.employeeId,
        updatedById: authority.employeeId,
        ...customerFields(snapshot),
      },
    });
    const now = new Date();
    const year = String(now.getFullYear() + 543).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const code = `QT-${year}${month}-${String(created.id).padStart(5, '0')}`;
    const quotation = await tx.quotation.update({
      where: { id: created.id },
      data: { code },
      include: quotationInclude,
    });
    await tx.quotationEvent.create({
      data: {
        quotationId: created.id,
        eventType: 'CREATED',
        resultingStatus: 'DRAFT',
        actorId: authority.employeeId,
        note: customerId ? 'Draft created with customer helper' : 'Empty draft created',
      },
    });
    return quotation;
  });
};

const list = async (input) => {
  const branchId = contract.positiveInt(input.branchId, 'branchId');
  const status = input.status ? String(input.status).toUpperCase() : undefined;
  const q = contract.text(input.q || input.query, 200);
  return prisma.quotation.findMany({
    where: {
      branchId,
      ...(status ? { status } : {}),
      ...(q ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { customerName: { contains: q, mode: 'insensitive' } },
          { customerCompany: { contains: q, mode: 'insensitive' } },
          { subject: { contains: q, mode: 'insensitive' } },
        ],
      } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(100, Math.max(1, Number(input.limit || 50))),
    include: { items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
  });
};

const detail = async (input) => ensureQuotation({
  quotationId: input.quotationId,
  branchId: contract.positiveInt(input.branchId, 'branchId'),
});

const updateDraft = async (input) => {
  const authority = actor(input);
  return prisma.$transaction(async (tx) => {
    await ensureActorAuthority(authority, tx);
    const quotation = await ensureQuotation({ quotationId: input.quotationId, branchId: authority.branchId }, tx);
    ensureDraft(quotation);
    const patch = contract.draftPatch(input);
    const snapshot = await loadCustomerSnapshot({ customerId: patch.customerId, branchId: authority.branchId }, tx);
    const selectedCustomerFields = snapshot ? customerFields(snapshot) : {};
    await tx.quotation.update({
      where: { id: quotation.id },
      data: {
        ...patch,
        ...selectedCustomerFields,
        updatedById: authority.employeeId,
        version: { increment: 1 },
      },
    });
    await tx.quotationEvent.create({
      data: {
        quotationId: quotation.id,
        eventType: 'UPDATED',
        previousStatus: quotation.status,
        resultingStatus: quotation.status,
        actorId: authority.employeeId,
      },
    });
    return recalculate({ quotationId: quotation.id, branchId: authority.branchId }, tx);
  });
};

const addLine = async (input) => {
  const authority = actor(input);
  return prisma.$transaction(async (tx) => {
    await ensureActorAuthority(authority, tx);
    const quotation = await ensureQuotation({ quotationId: input.quotationId, branchId: authority.branchId }, tx);
    ensureDraft(quotation);
    const payload = contract.linePayload(input);
    const lineSubtotal = money(payload.quantity * payload.unitPrice);
    const discountAmount = Math.min(lineSubtotal, payload.discountAmount);
    const lineTotal = money(lineSubtotal - discountAmount);
    const line = await tx.quotationItem.create({
      data: { ...payload, discountAmount, lineSubtotal, lineTotal, quotationId: quotation.id },
    });
    await tx.quotation.update({ where: { id: quotation.id }, data: { updatedById: authority.employeeId, version: { increment: 1 } } });
    await tx.quotationEvent.create({
      data: { quotationId: quotation.id, eventType: 'LINE_ADDED', previousStatus: quotation.status, resultingStatus: quotation.status, actorId: authority.employeeId, note: line.title },
    });
    await recalculate({ quotationId: quotation.id, branchId: authority.branchId }, tx);
    return line;
  });
};

const updateLine = async (input) => {
  const authority = actor(input);
  return prisma.$transaction(async (tx) => {
    await ensureActorAuthority(authority, tx);
    const quotation = await ensureQuotation({ quotationId: input.quotationId, branchId: authority.branchId }, tx);
    ensureDraft(quotation);
    const lineId = contract.positiveInt(input.lineId, 'lineId');
    const existing = await tx.quotationItem.findFirst({ where: { id: lineId, quotationId: quotation.id } });
    if (!existing) contract.fail('Quotation line not found', 'QUOTATION_LINE_NOT_FOUND', 404);
    const payload = contract.linePayload(input);
    const lineSubtotal = money(payload.quantity * payload.unitPrice);
    const discountAmount = Math.min(lineSubtotal, payload.discountAmount);
    const lineTotal = money(lineSubtotal - discountAmount);
    const line = await tx.quotationItem.update({
      where: { id: lineId },
      data: { ...payload, discountAmount, lineSubtotal, lineTotal },
    });
    await tx.quotation.update({ where: { id: quotation.id }, data: { updatedById: authority.employeeId, version: { increment: 1 } } });
    await tx.quotationEvent.create({
      data: { quotationId: quotation.id, eventType: 'LINE_UPDATED', previousStatus: quotation.status, resultingStatus: quotation.status, actorId: authority.employeeId, note: line.title },
    });
    await recalculate({ quotationId: quotation.id, branchId: authority.branchId }, tx);
    return line;
  });
};

const removeLine = async (input) => {
  const authority = actor(input);
  return prisma.$transaction(async (tx) => {
    await ensureActorAuthority(authority, tx);
    const quotation = await ensureQuotation({ quotationId: input.quotationId, branchId: authority.branchId }, tx);
    ensureDraft(quotation);
    const lineId = contract.positiveInt(input.lineId, 'lineId');
    const existing = await tx.quotationItem.findFirst({ where: { id: lineId, quotationId: quotation.id } });
    if (!existing) contract.fail('Quotation line not found', 'QUOTATION_LINE_NOT_FOUND', 404);
    await tx.quotationItem.delete({ where: { id: lineId } });
    await tx.quotation.update({ where: { id: quotation.id }, data: { updatedById: authority.employeeId, version: { increment: 1 } } });
    await tx.quotationEvent.create({
      data: { quotationId: quotation.id, eventType: 'LINE_REMOVED', previousStatus: quotation.status, resultingStatus: quotation.status, actorId: authority.employeeId, note: existing.title },
    });
    return recalculate({ quotationId: quotation.id, branchId: authority.branchId }, tx);
  });
};

const issue = async (input) => {
  const authority = actor(input);
  return prisma.$transaction(async (tx) => {
    await ensureActorAuthority(authority, tx);
    let quotation = await ensureQuotation({ quotationId: input.quotationId, branchId: authority.branchId }, tx);
    ensureIssuable(quotation);

    quotation = await recalculate({ quotationId: quotation.id, branchId: authority.branchId }, tx);
    ensureIssuable(quotation);

    const issuedAt = new Date();
    const issueDate = quotation.issueDate || issuedAt;
    const branch = await tx.branch.findUnique({
      where: { id: authority.branchId },
      select: { id: true, name: true, address: true, phone: true, taxId: true, isHeadOffice: true, branchCode: true, documentHeaderConfig: true },
    });
    const documentHeaderSnapshot = branch || null;
    const customerSnapshot = {
      ...(quotation.customerSnapshot && typeof quotation.customerSnapshot === 'object' ? quotation.customerSnapshot : {}),
      customerId: quotation.customerId,
      name: quotation.customerName,
      company: quotation.customerCompany,
      department: quotation.customerDepartment,
      contactName: quotation.customerContactName,
      phone: quotation.customerPhone,
      taxId: quotation.customerTaxId,
      address: quotation.customerAddress,
    };
    const issuedSnapshot = buildIssuedSnapshot({
      quotation: { ...quotation, issueDate },
      documentHeaderSnapshot,
      customerSnapshot,
      issuedAt,
    });

    const updated = await tx.quotation.update({
      where: { id: quotation.id },
      data: {
        status: 'ISSUED',
        issueDate,
        issuedAt,
        updatedById: authority.employeeId,
        version: { increment: 1 },
        documentHeaderSnapshot,
        customerSnapshot,
        issuedSnapshot,
      },
      include: quotationInclude,
    });
    await tx.quotationEvent.create({
      data: {
        quotationId: quotation.id,
        eventType: 'ISSUED',
        previousStatus: quotation.status,
        resultingStatus: 'ISSUED',
        actorId: authority.employeeId,
        note: contract.text(input.note, 1000),
      },
    });
    return updated;
  });
};

const transition = ({ action, from, to, eventType, timestampField }) => async (input) => {
  const authority = actor(input);
  return prisma.$transaction(async (tx) => {
    await ensureActorAuthority(authority, tx);
    const quotation = await ensureQuotation({ quotationId: input.quotationId, branchId: authority.branchId }, tx);
    if (!from.includes(quotation.status)) contract.fail(`Cannot ${action} quotation from ${quotation.status}`, 'QUOTATION_TRANSITION_REJECTED', 409);
    if (!quotation.issuedSnapshot && quotation.status !== 'DRAFT') {
      contract.fail('Issued quotation snapshot is missing', 'QUOTATION_ISSUED_SNAPSHOT_REQUIRED', 409);
    }
    const data = { status: to, updatedById: authority.employeeId, version: { increment: 1 } };
    if (timestampField) data[timestampField] = new Date();
    const updated = await tx.quotation.update({ where: { id: quotation.id }, data, include: quotationInclude });
    await tx.quotationEvent.create({
      data: { quotationId: quotation.id, eventType, previousStatus: quotation.status, resultingStatus: to, actorId: authority.employeeId, note: contract.text(input.note, 1000) },
    });
    return updated;
  });
};

const accept = transition({ action: 'accept', from: ['ISSUED'], to: 'ACCEPTED', eventType: 'ACCEPTED', timestampField: 'acceptedAt' });
const reject = transition({ action: 'reject', from: ['ISSUED'], to: 'REJECTED', eventType: 'REJECTED', timestampField: 'rejectedAt' });
const cancel = transition({ action: 'cancel', from: ['DRAFT', 'ISSUED', 'ACCEPTED'], to: 'CANCELLED', eventType: 'CANCELLED', timestampField: 'cancelledAt' });

module.exports = Object.freeze({
  accept,
  addLine,
  cancel,
  create,
  detail,
  issue,
  list,
  reject,
  removeLine,
  updateDraft,
  updateLine,
});