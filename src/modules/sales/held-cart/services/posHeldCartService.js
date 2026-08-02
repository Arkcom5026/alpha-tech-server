'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');
const contract = require('../contracts/posHeldCartContract');
const repository = require('../repositories/posHeldCartRepository');
const effectivePricePolicy = require('../../../product/pricing/policies/effectivePricePolicy');

const actor = (input) => ({
  branchId: contract.positiveInt(input.branchId, 'branchId'),
  employeeId: contract.positiveInt(input.employeeId, 'employeeId'),
});
const list = (input) => repository.list({
  branchId: contract.positiveInt(input.branchId, 'branchId'),
  status: input.status === '' ? null : String(input.status || 'OPEN').toUpperCase(),
  query: input.query || input.q,
  limit: input.limit,
});
const detail = (input) => repository.detail({
  branchId: contract.positiveInt(input.branchId, 'branchId'),
  heldCartId: contract.positiveInt(input.heldCartId, 'heldCartId'),
});
const create = (input) => prisma.$transaction((tx) => repository.create({
  ...actor(input), snapshot: contract.parseSnapshot(input),
}, tx));
const update = (input) => prisma.$transaction((tx) => repository.update({
  ...actor(input),
  heldCartId: contract.positiveInt(input.heldCartId, 'heldCartId'),
  expectedVersion: contract.positiveInt(input.expectedVersion, 'expectedVersion'),
  snapshot: contract.parseSnapshot(input),
}, tx));
const cancel = (input) => prisma.$transaction((tx) => repository.cancel({
  ...actor(input),
  heldCartId: contract.positiveInt(input.heldCartId, 'heldCartId'),
  reason: contract.text(input.reason, 500) || contract.fail('Cancellation reason is required', 'HELD_CART_CANCEL_REASON_REQUIRED'),
}, tx));

const resolveLinePrice = ({ row, priceType, branchId, productId, lineKey }) => (
  effectivePricePolicy.resolveEffectivePrice({
    row,
    priceType,
    context: { branchId, productId, lineKey },
  }).price
);

const revalidate = async (input) => {
  const branchId = contract.positiveInt(input.branchId, 'branchId');
  const heldCartId = contract.positiveInt(input.heldCartId, 'heldCartId');
  const cart = await repository.detail({ branchId, heldCartId });
  const results = [];
  for (const line of cart.lines) {
    if (line.lineType === 'STOCK_ITEM') {
      const rows = await prisma.$queryRaw(Prisma.sql`
        SELECT item."status", item."branchId", product."active",
          price."priceRetail", price."priceTechnician", price."priceWholesale"
        FROM "StockItem" item
        JOIN "Product" product ON product."id" = item."productId"
        LEFT JOIN "BranchPrice" price ON price."productId" = product."id"
          AND price."branchId" = ${branchId} AND price."isActive" = true
        WHERE item."id" = ${line.stockItemId} AND item."productId" = ${line.productId}
        LIMIT 1
      `);
      const row = rows[0];
      const available = !!row && Number(row.branchId) === branchId && row.status === 'IN_STOCK' && row.active;
      const price = resolveLinePrice({ row, priceType: cart.priceType, branchId, productId: line.productId, lineKey: line.lineKey });
      results.push({ lineKey: line.lineKey, available, code: available ? 'READY' : 'STOCK_ITEM_UNAVAILABLE', currentPrice: price, priceChanged: Math.abs(price - line.unitPrice) > 0.01 });
      continue;
    }
    const rows = await prisma.$queryRaw(Prisma.sql`
      SELECT product."active", product."mode", product."inventoryBehavior",
        lot."status" AS "lotStatus", lot."qtyRemaining", lot."branchId" AS "lotBranchId",
        balance."quantity", balance."reserved",
        price."priceRetail", price."priceTechnician", price."priceWholesale"
      FROM "Product" product
      LEFT JOIN "SimpleLot" lot ON lot."id" = ${line.simpleLotId}
      LEFT JOIN "StockBalance" balance ON balance."productId" = product."id" AND balance."branchId" = ${branchId}
      LEFT JOIN "BranchPrice" price ON price."productId" = product."id"
        AND price."branchId" = ${branchId} AND price."isActive" = true
      WHERE product."id" = ${line.productId}
      LIMIT 1
    `);
    const row = rows[0];
    const nonStock = row?.inventoryBehavior === 'NON_STOCK';
    const lotAvailable = nonStock || (
      line.simpleLotId && Number(row?.lotBranchId) === branchId && row?.lotStatus === 'ACTIVE'
      && Number(row?.qtyRemaining || 0) + 0.0001 >= line.quantity
    );
    const balanceAvailable = nonStock || Number(row?.quantity || 0) - Number(row?.reserved || 0) + 0.0001 >= line.quantity;
    const available = !!row && row.active && row.mode === 'SIMPLE' && lotAvailable && balanceAvailable;
    const price = resolveLinePrice({ row, priceType: cart.priceType, branchId, productId: line.productId, lineKey: line.lineKey });
    results.push({ lineKey: line.lineKey, available, code: available ? 'READY' : 'SIMPLE_QUANTITY_UNAVAILABLE', currentPrice: price, priceChanged: Math.abs(price - line.unitPrice) > 0.01 });
  }
  return {
    heldCartId, version: cart.version,
    ready: results.every((item) => item.available),
    priceChanged: results.some((item) => item.priceChanged),
    lines: results,
  };
};

module.exports = Object.freeze({ cancel, create, detail, list, revalidate, update });
