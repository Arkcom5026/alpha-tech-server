// src/modules/sales/services/saleDocument.service.js

const normalizeDocumentLineText = (value) => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeDocumentLineUpdates = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      id: Number(item?.id),
      documentPrefix: normalizeDocumentLineText(item?.documentPrefix),
      documentDescription: normalizeDocumentLineText(item?.documentDescription),
      documentSuffix: normalizeDocumentLineText(item?.documentSuffix),
    }))
    .filter((item) => Number.isInteger(item.id) && item.id > 0);
};

const updateSaleDocumentLines = async ({
  prisma,
  saleId,
  branchId,
  items = [],
  simpleItems = [],
}) => {
  const normalizedSaleId = Number(saleId);
  const normalizedBranchId = Number(branchId);

  if (!Number.isInteger(normalizedSaleId) || normalizedSaleId <= 0) {
    const error = new Error('Sale ID ไม่ถูกต้อง');
    error.status = 400;
    throw error;
  }

  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    const error = new Error('ไม่ได้รับข้อมูลสาขาที่ถูกต้อง');
    error.status = 401;
    throw error;
  }

  const sale = await prisma.sale.findUnique({
    where: { id: normalizedSaleId },
    select: {
      id: true,
      branchId: true,
    },
  });

  if (!sale || Number(sale.branchId) !== normalizedBranchId) {
    const error = new Error('ไม่พบรายการขายนี้ในสาขาของคุณ');
    error.status = 404;
    throw error;
  }

  const saleItemUpdates = normalizeDocumentLineUpdates(items);
  const simpleItemUpdates = normalizeDocumentLineUpdates(simpleItems);

  if (saleItemUpdates.length === 0 && simpleItemUpdates.length === 0) {
    return {
      success: true,
      updated: {
        items: 0,
        simpleItems: 0,
      },
    };
  }

  const operations = [
    ...saleItemUpdates.map((item) =>
      prisma.saleItem.updateMany({
        where: {
          id: item.id,
          saleId: normalizedSaleId,
        },
        data: {
          documentPrefix: item.documentPrefix,
          documentDescription: item.documentDescription,
          documentSuffix: item.documentSuffix,
        },
      })
    ),
    ...simpleItemUpdates.map((item) =>
      prisma.saleItemSimple.updateMany({
        where: {
          id: item.id,
          saleId: normalizedSaleId,
        },
        data: {
          documentPrefix: item.documentPrefix,
          documentDescription: item.documentDescription,
          documentSuffix: item.documentSuffix,
        },
      })
    ),
  ];

  const results = await prisma.$transaction(operations);

  const updatedSaleItems = results
    .slice(0, saleItemUpdates.length)
    .reduce((sum, result) => sum + Number(result?.count || 0), 0);

  const updatedSimpleItems = results
    .slice(saleItemUpdates.length)
    .reduce((sum, result) => sum + Number(result?.count || 0), 0);

  return {
    success: true,
    updated: {
      items: updatedSaleItems,
      simpleItems: updatedSimpleItems,
    },
  };
};

// 🧭 Backward-compatible aliases during transition.
const normalizeDocumentDescription = normalizeDocumentLineText;
const normalizeDocumentDescriptionUpdates = normalizeDocumentLineUpdates;
const updateSaleDocumentDescriptions = updateSaleDocumentLines;

module.exports = {
  normalizeDocumentLineText,
  normalizeDocumentLineUpdates,
  updateSaleDocumentLines,

  normalizeDocumentDescription,
  normalizeDocumentDescriptionUpdates,
  updateSaleDocumentDescriptions,
};
