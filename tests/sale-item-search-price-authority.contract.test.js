'use strict';

const assert = require('assert');
const service = require('../src/modules/sales/item-search/services/saleItemSearchService');

const product = {
  id: 10,
  active: true,
  mode: 'SIMPLE',
  branchPrice: [{
    priceRetail: 150,
    priceWholesale: 140,
    priceTechnician: 130,
    priceOnline: 145,
  }],
};

assert.deepStrictEqual(
  service.mapSimpleLot({
    id: 20,
    productId: 10,
    barcode: 'SIMPLE-1',
    qtyRemaining: 2,
    status: 'ACTIVE',
    product,
  }, 2).prices,
  { retail: 150, wholesale: 140, technician: 130, online: 145 },
);

assert.throws(
  () => service.mapStockItem({
    id: 30,
    productId: 11,
    barcode: 'STOCK-1',
    status: 'IN_STOCK',
    product: { id: 11, branchPrice: [] },
  }, 2),
  (error) => error.code === 'ACTIVE_BRANCH_PRICE_NOT_FOUND'
    && error.details?.branchId === 2
    && error.details?.productId === 11,
);

assert.throws(
  () => service.mapSimpleLot({
    id: 21,
    productId: 12,
    barcode: 'SIMPLE-2',
    qtyRemaining: 1,
    status: 'ACTIVE',
    product: {
      id: 12,
      active: true,
      mode: 'SIMPLE',
      branchPrice: [{
        priceRetail: 0,
        priceWholesale: 140,
        priceTechnician: 130,
        priceOnline: 145,
      }],
    },
  }, 2),
  (error) => error.code === 'PRICE_VALUE_NOT_EFFECTIVE',
);

assert.throws(
  () => service.mapSimpleLot({
    id: 22,
    productId: 13,
    barcode: 'SIMPLE-3',
    qtyRemaining: 1,
    status: 'ACTIVE',
    product: {
      id: 13,
      active: true,
      mode: 'SIMPLE',
      branchPrice: [{
        priceRetail: 150,
        priceWholesale: null,
        priceTechnician: 130,
        priceOnline: 145,
      }],
    },
  }, 2),
  (error) => error.code === 'PRICE_VALUE_MISSING',
);

console.log('sale-item-search-price-authority.contract.test.js: PASS');
