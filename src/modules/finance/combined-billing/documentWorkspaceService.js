'use strict';

const { prisma, Prisma } = require('../../../../lib/prisma');
const { generateCombinedBillingCode } = require('./create/createCombinedBillingDocumentRepository');
const { buildTaxCandidateRegistration } = require('../../tax/candidates/contracts/taxCandidateContract');
const { mapCandidateToTaxDocumentDraft } = require('../../tax/candidates/mapping/mapCandidateToTaxDocument');
const candidateRepository = require('../../tax/candidates/repository/taxCandidateRepository');
const taxDocumentRepository = require('../../tax/documents/repository/taxDocumentRepository');
const { resolveFinancialCustomerGroup } = require('../../customer/financial-group/customerFinancialGroupResolver');

const money = (value) => Number(Number(value || 0).toFixed(2));
const keyOf = (type, id) => `${type}:${id}`;
const fail = (code, message, statusCode = 400) => { const error = new Error(message); error.code = code; error.statusCode = statusCode; throw error; };
const customerInclude = { user: true, subdistrict: { include: { district: { include: { province: true } } } } };

const registerConsolidatedTaxCandidate = async ({ tx, document, branchId, employeeId }) => {
  const snapshot = {
    subtotalAmount: money(document.totalBeforeVat), taxAmount: money(document.vatAmount),
    totalAmount: money(document.totalAmount), counterpartyTaxId: document.customer?.taxId || null,
    customer: document.customer, items: document.documentLines,
    sourceDocumentNo: document.code,
    sourceReferences: document.documentLines.map((line) => ({ sourceSaleId: line.sourceSaleId, sourceDocumentNo: line.sourceDocumentNo, sourceLineType: line.sourceLineType, sourceLineId: line.sourceLineId })),
  };
  const registration = buildTaxCandidateRegistration({ branchId, sourceType: 'CONSOLIDATED_DELIVERY', sourceId: String(document.id), sourceDocumentNo: document.code, occurredAt: document.issueDate, snapshot });
  const candidate = await candidateRepository.create(registration, tx);
  const mapped = mapCandidateToTaxDocumentDraft({ candidate, documentNumber: document.code, counterpartyTaxId: snapshot.counterpartyTaxId, documentType: 'OUTPUT_TAX_INVOICE' });
  await candidateRepository.updateMapped({ id: candidate.id, mappedDocumentType: mapped.documentType }, tx);
  const taxDocument = await taxDocumentRepository.create({ branchId, candidateId: candidate.id, documentType: mapped.documentType, documentNumber: mapped.documentNumber, counterpartyTaxId: mapped.counterpartyTaxId, identityKey: mapped.identityKey, status: mapped.status, issuedAt: null, occurredAt: registration.occurredAt, currency: 'THB', subtotalAmount: snapshot.subtotalAmount, taxAmount: snapshot.taxAmount, totalAmount: snapshot.totalAmount, snapshot }, tx);
  await taxDocumentRepository.appendLifecycleEvent({ taxDocumentId: taxDocument.id, fromStatus: null, toStatus: 'DRAFT', reason: 'Created from consolidated delivery document', actorEmployeeId: employeeId, metadata: { registrationKey: registration.registrationKey, sourceType: registration.sourceType, sourceId: registration.sourceId } }, tx);
  await candidateRepository.updateConverted(candidate.id, tx);
  return taxDocument;
};

const lineProjection = (sale, type, item, settledAmount) => {
  const quantity = type === 'STOCK' ? 1 : money(item.quantity);
  const amount = money(item.price);
  return {
    saleId: sale.id,
    saleCode: sale.code,
    sourceDocumentNo: sale.officialDocumentNumber,
    soldAt: sale.soldAt,
    lineType: type,
    lineId: item.id,
    status: settledAmount >= amount ? 'PAID_READY' : settledAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
    description: item.documentDescription || item.product?.name || item.stockItem?.product?.name || 'สินค้า',
    quantity,
    sourceUnitPrice: quantity ? money(amount / quantity) : amount,
    sourceAmount: amount,
    settledAmount: money(settledAmount),
  };
};

const listDocumentWorkspace = async ({ branchId, customerId }) => {
  branchId = Number(branchId); customerId = Number(customerId);
  if (!branchId || !customerId) fail('DOCUMENT_WORKSPACE_CONTEXT_REQUIRED', 'branchId and customerId are required');
  const group = await resolveFinancialCustomerGroup(prisma, { branchId, customerId });
  const sales = await prisma.sale.findMany({
    where: {
      branchId,
      customerId: { in: group.memberIds },
      isCredit: true,
      status: { not: 'CANCELLED' },
      officialDocumentNumber: { not: null },
    },
    select: {
      id: true, customerId: true, code: true, officialDocumentNumber: true, soldAt: true,
      items: { select: { id: true, price: true, documentDescription: true, stockItem: { select: { product: { select: { name: true } } } } } },
      simpleItems: { select: { id: true, quantity: true, price: true, documentDescription: true, product: { select: { name: true } } } },
    },
    orderBy: [{ soldAt: 'asc' }, { id: 'asc' }],
  });
  const saleIds = sales.map((sale) => sale.id);
  const [settlements, documented] = await Promise.all([
    saleIds.length ? prisma.customerMoneySettlementLine.findMany({ where: { saleId: { in: saleIds }, settlement: { status: 'ACTIVE' } }, select: { saleId: true, saleItemType: true, saleItemId: true, appliedAmount: true } }) : [],
    saleIds.length ? prisma.consolidatedDeliveryLine.findMany({ where: { branchId, sourceSaleId: { in: saleIds }, status: 'DOCUMENTED' }, select: { sourceLineType: true, sourceLineId: true, combinedBillingId: true } }) : [],
  ]);
  const paid = new Map();
  for (const row of settlements) paid.set(`${row.saleId}:${keyOf(row.saleItemType, row.saleItemId)}`, money((paid.get(`${row.saleId}:${keyOf(row.saleItemType, row.saleItemId)}`) || 0) + Number(row.appliedAmount)));
  const consumed = new Map(documented.map((row) => [keyOf(row.sourceLineType, row.sourceLineId), row.combinedBillingId]));
  return sales.map((sale) => {
    const lines = [
      ...sale.items.map((item) => lineProjection(sale, 'STOCK', item, paid.get(`${sale.id}:${keyOf('STOCK', item.id)}`) || 0)),
      ...sale.simpleItems.map((item) => lineProjection(sale, 'SIMPLE', item, paid.get(`${sale.id}:${keyOf('SIMPLE', item.id)}`) || 0)),
    ].map((line) => consumed.has(keyOf(line.lineType, line.lineId)) ? { ...line, status: 'DOCUMENTED', combinedBillingId: consumed.get(keyOf(line.lineType, line.lineId)) } : line);
    const counts = lines.reduce((acc, line) => ({ ...acc, [line.status]: (acc[line.status] || 0) + 1 }), {});
    const documentStatus = lines.length && lines.every((line) => line.status === 'DOCUMENTED') ? 'CLOSED' : lines.some((line) => line.status === 'DOCUMENTED') ? 'PARTIALLY_DOCUMENTED' : 'OPEN';
    return { id: sale.id, customerId: sale.customerId, code: sale.code, documentNo: sale.officialDocumentNumber, soldAt: sale.soldAt, documentStatus, counts, lines };
  });
};

const confirmDocumentWorkspace = async ({ branchId, customerId, employeeId, note, lines }) => {
  branchId = Number(branchId); customerId = Number(customerId); employeeId = Number(employeeId);
  if (!branchId || !customerId || !employeeId) fail('DOCUMENT_WORKSPACE_CONTEXT_REQUIRED', 'Branch, customer and employee context are required', 403);
  if (!Array.isArray(lines) || !lines.length) fail('DOCUMENT_WORKSPACE_LINES_REQUIRED', 'Select at least one paid delivery line');
  const requested = lines.map((line) => ({ lineType: String(line.lineType || '').toUpperCase(), lineId: Number(line.lineId), documentUnitPrice: money(line.documentUnitPrice), adjustmentReason: String(line.adjustmentReason || '').trim() || null }));
  if (requested.some((line) => !['STOCK', 'SIMPLE'].includes(line.lineType) || !line.lineId || line.documentUnitPrice < 0)) fail('DOCUMENT_WORKSPACE_LINE_INVALID', 'One or more document lines are invalid');

  const document = await prisma.$transaction(async (tx) => {
    const group = await resolveFinancialCustomerGroup(tx, { branchId, customerId });
    const stockIds = requested.filter((x) => x.lineType === 'STOCK').map((x) => x.lineId);
    const simpleIds = requested.filter((x) => x.lineType === 'SIMPLE').map((x) => x.lineId);
    const sales = await tx.sale.findMany({
      where: {
        branchId,
        customerId: { in: group.memberIds },
        isCredit: true,
        status: { not: 'CANCELLED' },
        officialDocumentNumber: { not: null },
        OR: [
          { items: { some: { id: { in: stockIds } } } },
          { simpleItems: { some: { id: { in: simpleIds } } } },
        ],
      },
      include: {
        customer: true,
        items: { where: { id: { in: stockIds } }, include: { stockItem: { include: { product: true } } } },
        simpleItems: { where: { id: { in: simpleIds } }, include: { product: true } },
      },
    });
    const source = new Map();
    for (const sale of sales) {
      for (const item of sale.items) source.set(keyOf('STOCK', item.id), lineProjection(sale, 'STOCK', item, 0));
      for (const item of sale.simpleItems) source.set(keyOf('SIMPLE', item.id), lineProjection(sale, 'SIMPLE', item, 0));
    }
    if (source.size !== requested.length) fail('DOCUMENT_WORKSPACE_SOURCE_INVALID', 'A source line is missing, has no issued delivery note, is not a credit delivery note, or is outside this customer/branch', 409);

    const alreadyDocumented = await tx.consolidatedDeliveryLine.findFirst({
      where: { branchId, OR: requested.map((line) => ({ sourceLineType: line.lineType, sourceLineId: line.lineId })) },
      select: { combinedBillingId: true, sourceDocumentNo: true },
    });
    if (alreadyDocumented) {
      fail('DOCUMENT_WORKSPACE_LINE_ALREADY_DOCUMENTED', `รายการจาก ${alreadyDocumented.sourceDocumentNo} ถูกนำไปสร้างใบส่งของรวมแล้ว`, 409);
    }

    const settlementRows = await tx.customerMoneySettlementLine.findMany({
      where: { OR: requested.map((line) => ({ saleItemType: line.lineType, saleItemId: line.lineId })), settlement: { status: 'ACTIVE', branchId, customerId: group.ownerId } },
      select: { saleItemType: true, saleItemId: true, appliedAmount: true },
    });
    const settled = new Map();
    for (const row of settlementRows) settled.set(keyOf(row.saleItemType, row.saleItemId), money((settled.get(keyOf(row.saleItemType, row.saleItemId)) || 0) + Number(row.appliedAmount)));

    const data = requested.map((request) => {
      const item = source.get(keyOf(request.lineType, request.lineId));
      const settledAmount = settled.get(keyOf(request.lineType, request.lineId)) || 0;
      const documentAmount = money(request.documentUnitPrice * item.quantity);
      if (settledAmount < documentAmount) fail('DOCUMENT_WORKSPACE_ADDITIONAL_PAYMENT_REQUIRED', `ยอดชำระของ ${item.description} ไม่พอราคาสุดท้าย`, 409);
      const priceAdjustment = money(request.documentUnitPrice - item.sourceUnitPrice);
      if (priceAdjustment !== 0 && !request.adjustmentReason) fail('DOCUMENT_WORKSPACE_ADJUSTMENT_REASON_REQUIRED', 'กรุณาระบุเหตุผลเมื่อปรับราคา');
      return { request, item, settledAmount, documentAmount, priceAdjustment };
    });

    const sourceSaleIds = [...new Set(data.map((row) => Number(row.item.saleId)))];
    const issuedSourceTax = sourceSaleIds.length
      ? await tx.taxCandidate.findFirst({
          where: {
            branchId,
            sourceType: 'SALE',
            sourceId: { in: sourceSaleIds.map(String) },
            document: { is: { documentType: 'OUTPUT_TAX_INVOICE', status: 'REGISTERED', issuedDocumentNumber: { not: null } } },
          },
          select: { sourceId: true, document: { select: { issuedDocumentNumber: true } } },
        })
      : null;
    if (issuedSourceTax) {
      fail(
        'DOCUMENT_WORKSPACE_SOURCE_TAX_ALREADY_ISSUED',
        `ใบส่งของต้นทางมีใบกำกับภาษีออกแล้ว (${issuedSourceTax.document?.issuedDocumentNumber || issuedSourceTax.sourceId}) จึงไม่สามารถนำมารวมเพื่อสร้างเอกสารภาษีใหม่ได้`,
        409,
      );
    }

    const totalAmount = money(data.reduce((sum, row) => sum + row.documentAmount, 0));
    const code = await generateCombinedBillingCode(tx, branchId, new Date());
    const created = await tx.combinedBillingDocument.create({
      data: {
        code, note: String(note || ''), createdBy: employeeId, customerId: group.ownerId, branchId,
        totalBeforeVat: new Prisma.Decimal(totalAmount), vatAmount: new Prisma.Decimal(0), totalAmount: new Prisma.Decimal(totalAmount), status: 'ISSUED',
        documentLines: { create: data.map(({ request, item, settledAmount, documentAmount, priceAdjustment }) => ({
          branchId, customerId: group.ownerId, sourceSaleId: item.saleId, sourceSaleCode: item.saleCode,
          sourceDocumentNo: item.sourceDocumentNo, sourceLineType: request.lineType, sourceLineId: request.lineId,
          description: item.description, quantity: new Prisma.Decimal(item.quantity), sourceUnitPrice: new Prisma.Decimal(item.sourceUnitPrice),
          documentUnitPrice: new Prisma.Decimal(request.documentUnitPrice), priceAdjustment: new Prisma.Decimal(priceAdjustment),
          adjustmentReason: request.adjustmentReason, settledAmount: new Prisma.Decimal(settledAmount), documentAmount: new Prisma.Decimal(documentAmount),
          sourceSnapshot: item, adjustedById: priceAdjustment ? employeeId : null, adjustedAt: priceAdjustment ? new Date() : null,
        })) },
      },
      include: { documentLines: true, customer: { include: customerInclude } },
    });

    const refund = money(data.reduce((sum, row) => sum + Math.max(0, row.settledAmount - row.documentAmount), 0));
    if (refund > 0) {
      await tx.customerMoneyBalance.upsert({ where: { branchId_customerId: { branchId, customerId: group.ownerId } }, create: { branchId, customerId: group.ownerId, availableAmount: new Prisma.Decimal(refund) }, update: { availableAmount: { increment: new Prisma.Decimal(refund) } } });
      await tx.customerMoneyLedger.create({ data: { branchId, customerId: group.ownerId, eventType: 'DOCUMENT_PRICE_ADJUSTMENT_RELEASE', amount: new Prisma.Decimal(refund), direction: 'CREDIT', referenceType: 'CONSOLIDATED_DELIVERY', referenceId: created.id, createdById: employeeId } });
    }

    const taxDocument = await registerConsolidatedTaxCandidate({ tx, document: created, branchId, employeeId });
    return { ...created, taxDocument, taxAuthorityMode: 'CONSOLIDATED_TAX_DRAFT' };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
  return document;
};

module.exports = { listDocumentWorkspace, confirmDocumentWorkspace, lineProjection, keyOf };
