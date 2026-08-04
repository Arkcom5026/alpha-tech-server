const saleItemSearchRepository = require('../repositories/saleItemSearchRepository');
const effectivePricePolicy = require('../../../product/pricing/policies/effectivePricePolicy');

const MIN_TEXT_QUERY_LENGTH = 3;
const MAX_RESULTS = 40;

class SaleItemSearchError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'SaleItemSearchError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const toNumber = (value) => {
  if (value && typeof value.toNumber === 'function') return value.toNumber();
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pricesOf = (product, branchId) => {
  const price = product?.branchPrice?.[0];
  if (!price) {
    throw new SaleItemSearchError(409, 'ACTIVE_BRANCH_PRICE_NOT_FOUND', 'ไม่พบราคาที่ใช้งานสำหรับสินค้านี้ในร้านปัจจุบัน', {
      branchId,
      productId: product?.id ?? null,
    });
  }

  const resolveOptional = (priceType) => {
    try {
      return effectivePricePolicy.resolveEffectivePrice({
        row: price,
        priceType,
        context: { branchId, productId: product?.id },
      }).price;
    } catch (error) {
      if (error?.code === 'PRICE_VALUE_MISSING' || error?.code === 'PRICE_VALUE_NOT_EFFECTIVE') return null;
      throw error;
    }
  };

  return {
    retail: resolveOptional('retail'),
    wholesale: resolveOptional('wholesale'),
    technician: resolveOptional('technician'),
    online: resolveOptional('online'),
  };
};

const productSummary = (product) => ({
  ...product,
  brandName: product?.brand?.name || null,
  productTypeName: product?.productType?.name || null,
  coverImageUrl: product?.productImages?.[0]?.secure_url || product?.productImages?.[0]?.url || null,
});

const mapStockItem = (stockItem, branchId, matchReason = null, authority = null) => ({
  type: 'STOCK',
  lineType: 'STOCK_ITEM',
  productId: stockItem.productId,
  stockItemId: stockItem.id,
  simpleLotId: null,
  barcode: stockItem.barcode,
  serialNumber: stockItem.serialNumber || null,
  quantityAvailable: 1,
  status: stockItem.status,
  matchReason,
  barcodeAuthority: authority,
  product: productSummary(stockItem.product),
  prices: pricesOf(stockItem.product, branchId),
});

const mapSimpleLot = (simpleLot, branchId, matchReason = null, authority = null) => ({
  type: 'SIMPLE',
  lineType: 'SIMPLE',
  productId: simpleLot.productId,
  stockItemId: null,
  simpleLotId: simpleLot.id,
  barcode: simpleLot.barcode,
  serialNumber: null,
  quantityAvailable: toNumber(simpleLot.qtyRemaining),
  qtyRemaining: toNumber(simpleLot.qtyRemaining),
  status: simpleLot.status,
  matchReason,
  barcodeAuthority: authority,
  product: productSummary(simpleLot.product),
  prices: pricesOf(simpleLot.product, branchId),
});

const exactReasonForStock = (item, normalized) => {
  if (String(item.barcode || '').toLowerCase() === normalized) return 'BARCODE_EXACT';
  if (String(item.serialNumber || '').toLowerCase() === normalized) return 'SERIAL_EXACT';
  if (String(item.product?.saleBarcode || '').toLowerCase() === normalized) return 'PRODUCT_BARCODE_EXACT';
  return 'IDENTIFIER_EXACT';
};

const exactReasonForSimple = (item, normalized) => (
  String(item.barcode || '').toLowerCase() === normalized ? 'BARCODE_EXACT' : 'PRODUCT_BARCODE_EXACT'
);

const assertExactSellable = (stockItems, simpleLots) => {
  const sellableStock = stockItems.filter((item) => (
    item.status === 'IN_STOCK'
    && item.product?.active === true
    && item.product?.inventoryBehavior === 'TRACKED'
  ));
  const sellableSimple = simpleLots.filter((item) => (
    item.status === 'ACTIVE'
    && toNumber(item.qtyRemaining) > 0
    && item.product?.active === true
    && item.product?.mode === 'SIMPLE'
    && item.product?.inventoryBehavior === 'TRACKED'
  ));

  if (sellableStock.length || sellableSimple.length) return { sellableStock, sellableSimple };

  const first = stockItems[0] || simpleLots[0];
  if (first) {
    throw new SaleItemSearchError(409, 'SALE_ITEM_NOT_SELLABLE', `พบสินค้าแต่ยังไม่พร้อมขาย (สถานะ: ${first.status})`, {
      type: stockItems[0] ? 'STOCK' : 'SIMPLE',
      status: first.status,
      stockItemId: stockItems[0]?.id,
      simpleLotId: simpleLots[0]?.id,
    });
  }

  return { sellableStock: [], sellableSimple: [] };
};

const uniqueByInventoryIdentity = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.type === 'STOCK' ? `stock:${item.stockItemId}` : `simple:${item.simpleLotId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const authoritySummary = (authority) => authority ? {
  id: authority.id,
  barcode: authority.barcode,
  kind: authority.kind,
  status: authority.status,
} : null;

const searchSaleItems = async ({ branchId, query, repository = saleItemSearchRepository }) => {
  const normalizedQuery = String(query || '').trim();
  if (!Number.isInteger(branchId) || branchId <= 0 || !normalizedQuery) {
    throw new SaleItemSearchError(400, 'SALE_ITEM_SEARCH_INVALID', 'branchId and query are required');
  }

  const normalizedLower = normalizedQuery.toLowerCase();
  const [authority, exactStock, exactSimple] = await Promise.all([
    repository.findBarcodeAuthorityExact({ branchId, query: normalizedQuery }),
    repository.findExactStockItems({ branchId, query: normalizedQuery, take: MAX_RESULTS }),
    repository.findExactSimpleLots({ branchId, query: normalizedQuery, take: MAX_RESULTS }),
  ]);

  const authorityStock = authority?.stockItem ? [authority.stockItem] : [];
  const authoritySimple = authority?.simpleLot ? [authority.simpleLot] : [];

  if (authority && !authority.stockItem && !authority.simpleLot) {
    throw new SaleItemSearchError(409, 'BARCODE_AUTHORITY_UNRESOLVED', 'พบบาร์โค้ดรับสินค้า แต่ยังไม่ได้เชื่อมกับสินค้าที่พร้อมขาย', {
      barcodeReceiptItemId: authority.id,
      barcode: authority.barcode,
      kind: authority.kind,
      status: authority.status,
    });
  }

  const { sellableStock, sellableSimple } = assertExactSellable(
    [...authorityStock, ...exactStock],
    [...authoritySimple, ...exactSimple],
  );

  const exactItems = uniqueByInventoryIdentity([
    ...sellableStock.map((item) => mapStockItem(
      item,
      branchId,
      authority?.stockItem?.id === item.id ? 'BARCODE_AUTHORITY_EXACT' : exactReasonForStock(item, normalizedLower),
      authority?.stockItem?.id === item.id ? authoritySummary(authority) : null,
    )),
    ...sellableSimple.map((item) => mapSimpleLot(
      item,
      branchId,
      authority?.simpleLot?.id === item.id ? 'BARCODE_AUTHORITY_EXACT' : exactReasonForSimple(item, normalizedLower),
      authority?.simpleLot?.id === item.id ? authoritySummary(authority) : null,
    )),
  ]);

  if (exactItems.length) {
    return {
      query: normalizedQuery,
      matchMode: 'IDENTIFIER',
      autoSelect: exactItems.length === 1,
      total: exactItems.length,
      truncated: false,
      items: exactItems,
    };
  }

  if (Array.from(normalizedQuery).length < MIN_TEXT_QUERY_LENGTH) {
    throw new SaleItemSearchError(400, 'SALE_ITEM_TEXT_QUERY_TOO_SHORT', `กรุณาระบุชื่อหรือรุ่นสินค้าอย่างน้อย ${MIN_TEXT_QUERY_LENGTH} ตัวอักษร`, {
      minLength: MIN_TEXT_QUERY_LENGTH,
    });
  }

  const terms = normalizedQuery.split(/\s+/).map((term) => term.trim()).filter(Boolean);
  const [textStock, textSimple] = await Promise.all([
    repository.findTextStockItems({ branchId, terms, take: MAX_RESULTS }),
    repository.findTextSimpleLots({ branchId, terms, take: MAX_RESULTS }),
  ]);

  const items = uniqueByInventoryIdentity([
    ...textStock.map((item) => mapStockItem(item, branchId, 'TEXT_MATCH')),
    ...textSimple.map((item) => mapSimpleLot(item, branchId, 'TEXT_MATCH')),
  ]).slice(0, MAX_RESULTS);

  return {
    query: normalizedQuery,
    matchMode: 'TEXT',
    autoSelect: false,
    total: items.length,
    truncated: textStock.length + textSimple.length >= MAX_RESULTS,
    items,
  };
};

module.exports = {
  MIN_TEXT_QUERY_LENGTH,
  SaleItemSearchError,
  searchSaleItems,
  mapStockItem,
  mapSimpleLot,
};
