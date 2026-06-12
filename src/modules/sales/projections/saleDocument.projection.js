// src/modules/sales/projections/saleDocument.projection.js

const resolveSaleItemProductName = (item) => {
    const product =
      item?.product ||
      item?.stockItem?.product ||
      item?.productSnapshot ||
      null;
  
    return (
      product?.name ||
      item?.productName ||
      item?.name ||
      'ไม่พบชื่อสินค้า'
    );
  };
  
  const resolveDocumentDescription = (item) => {
    const documentDescription =
      typeof item?.documentDescription === 'string'
        ? item.documentDescription.trim()
        : '';
  
    return documentDescription || resolveSaleItemProductName(item);
  };
  
  const buildSaleDocumentLineDescription = (item) => {
    return resolveDocumentDescription(item);
  };
  
  module.exports = {
    resolveSaleItemProductName,
    resolveDocumentDescription,
    buildSaleDocumentLineDescription,
  };