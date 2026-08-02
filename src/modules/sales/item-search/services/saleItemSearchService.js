const saleItemSearchRepository = require('../repositories/saleItemSearchRepository');
const effectivePricePolicy = require('../../../product/pricing/policies/effectivePricePolicy');

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
    throw new SaleItemSearchError(
      409,
      'ACTIVE_BRANCH_PRICE_NOT_FOUND',
      'ไม่พบราคาที่ใช้งานสำหรับสินค้านี้ในร้านปัจจุบัน',
      { branchId, productId: product?.id ?? null },
    );
  }

  const resolve = (priceType) => effectivePricePolicy.resolveEffectivePrice({
    row: price,
    priceType,
    branchId,
    productId: product?.id,
  });

  return {
    retail: resolve('retail'),
    wholesale: resolve('wholesale'),
    technician: resolve('technician'),
    online: resolve('online'),
  };
};

const mapStockItem = (stockItem, branchId) => ({
  type: 'STOCK',
  lineType: 'STOCK_ITEM',
  productId: stockItem.productId,
  stockItemId: stockItem.id,
  simpleLotId: null,
  barcode: stockItem.barcode,
  quantityAvailable: 1,
  status: stockItem.status,
  product: stockItem.product,
  prices: pricesOf(stockItem.product, branchId),
});

const mapSimpleLot = (simpleLot, branchId) => ({
  type: 'SIMPLE',
  lineType: 'SIMPLE',
  productId: simpleLot.productId,
  stockItemId: null,
  simpleLotId: simpleLot.id,
  barcode: simpleLot.barcode,
  quantityAvailable: toNumber(simpleLot.qtyRemaining),
  qtyRemaining: toNumber(simpleLot.qtyRemaining),
  status: simpleLot.status,
  product: simpleLot.product,
  prices: pricesOf(simpleLot.product, branchId),
});

const searchSaleItems = async ({ branchId, query, repository = saleItemSearchRepository }) => {
  const barcode = String(query || '').trim();
  if (!Number.isInteger(branchId) || branchId <= 0 || !barcode) {
    throw new SaleItemSearchError(400, 'SALE_ITEM_SEARCH_INVALID', 'branchId and query are required');
  }

  const stockItem = await repository.findStockItemByBarcode({ branchId, barcode });
  if (stockItem) {
    if (stockItem.status !== 'IN_STOCK') {
      throw new SaleItemSearchError(
        409,
        'BARCODE_NOT_SELLABLE',
        `สินค้านี้ไม่พร้อมขาย (สถานะ: ${stockItem.status})`,
        { type: 'STOCK', status: stockItem.status, stockItemId: stockItem.id }
      );
    }
    return { items: [mapStockItem(stockItem, branchId)] };
  }

  const simpleLot = await repository.findSimpleLotByBarcode({ branchId, barcode });
  if (!simpleLot) return { items: [] };

  if (simpleLot.status !== 'ACTIVE') {
    throw new SaleItemSearchError(
      409,
      'SIMPLE_LOT_NOT_ACTIVE',
      `ล็อตสินค้าไม่พร้อมขาย (สถานะ: ${simpleLot.status})`,
      { type: 'SIMPLE', status: simpleLot.status, simpleLotId: simpleLot.id }
    );
  }

  const quantityAvailable = toNumber(simpleLot.qtyRemaining);
  if (quantityAvailable <= 0) {
    throw new SaleItemSearchError(
      409,
      'SIMPLE_LOT_EMPTY',
      'ล็อตนี้ไม่มีจำนวนคงเหลือให้ขายแล้ว',
      { type: 'SIMPLE', simpleLotId: simpleLot.id, quantityAvailable }
    );
  }

  if (!simpleLot.product || simpleLot.product.active !== true || simpleLot.product.mode !== 'SIMPLE') {
    throw new SaleItemSearchError(
      409,
      'SIMPLE_PRODUCT_NOT_SELLABLE',
      'สินค้าแบบจำนวนนี้ไม่พร้อมขาย',
      { productId: simpleLot.productId, simpleLotId: simpleLot.id }
    );
  }

  return { items: [mapSimpleLot(simpleLot, branchId)] };
};

module.exports = {
  SaleItemSearchError,
  searchSaleItems,
  mapStockItem,
  mapSimpleLot,
};
