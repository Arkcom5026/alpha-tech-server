const dayjs = require('dayjs');
const { Prisma } = require('../../../../../lib/prisma');
const { SaleCompletionError: SalesError } = require('../contracts/saleCompletionError');
const { postPaymentEvidence } = require('./salePaymentPostingService');
const { stockConflict } = require('../policies/saleStockPolicy');
const { assertSaleReplayHash } = require('../policies/saleIdempotencyPolicy');
const {
  findActiveSalePayments,
  findCompletionCommand,
  runCompletionTransaction,
} = require('../repositories/saleCompletionRepository');

const D = (value) => new Prisma.Decimal(Number(value || 0).toFixed(2));
const SALE_CODE_MAX_RETRY = Math.max(0, Number(process.env.SALE_CODE_MAX_RETRY || 3));
const CREDIT_SALE_STATUS = process.env.CREDIT_SALE_STATUS || 'DRAFT';

const generateSaleCode = async (tx, branchId, attempt) => {
  const now = dayjs();
  const prefix = `SL-${String(branchId).padStart(2, '0')}${now.format('YYMM')}`;
  const count = await tx.sale.count({
    where: {
      branchId,
      createdAt: { gte: now.startOf('month').toDate(), lt: now.endOf('month').toDate() },
    },
  });
  return `${prefix}-${String(count + 1 + attempt).padStart(4, '0')}`;
};

const loadVerifiedReplay = async ({ branchId, commandKey, requestHash, replayed = true }) => {
  const stored = await findCompletionCommand({ branchId, commandKey });
  if (!stored) return null;
  assertSaleReplayHash({ storedHash: stored.requestHash, requestHash });
  const payments = await findActiveSalePayments(stored.saleId);
  return canonicalResult(stored.sale, payments, replayed, commandKey);
};

const canonicalResult = (sale, payments, replayed, commandKey) => ({
  saleId: sale.id,
  sale,
  payments,
  paymentSummary: {
    totalAmount: Number(sale.totalAmount),
    paidAmount: Number(sale.paidAmount),
    statusPayment: sale.statusPayment,
    outstandingAmount: Math.max(0, Number(sale.totalAmount) - Number(sale.paidAmount)),
  },
  completionStatus: sale.statusPayment === 'PAID' ? 'COMPLETED_PAID' : 'COMPLETED_CREDIT',
  documentDefaults: {
    option: sale.isCredit ? 'DELIVERY_NOTE' : 'RECEIPT',
    deliveryNoteMode: sale.isCredit ? 'PRINT' : null,
  },
  idempotency: { commandId: commandKey, replayed },
});

const productInventoryBehavior = (product) => {
  const authority = String(product?.inventoryBehavior || '').trim().toUpperCase();
  if (authority === 'TRACKED' || authority === 'NON_STOCK') return authority;

  const config = product?.productConfig && typeof product.productConfig === 'object'
    ? product.productConfig
    : {};
  const legacy = String(config.inventoryBehavior || config.stockBehavior || '').toUpperCase();
  if (legacy === 'NON_STOCK' || legacy === 'NONE' || legacy === 'SERVICE') return 'NON_STOCK';
  if (config.inventoryTracked === false || config.trackInventory === false || config.stockTracking === false) {
    return 'NON_STOCK';
  }
  return 'TRACKED';
};

const prepareMixedSaleEvidence = async ({ tx, items, branchId, reservationAllocation = null }) => {
  const stockLines = items.filter((item) => item.lineType === 'STOCK_ITEM');
  const simpleLines = items.filter((item) => item.lineType === 'SIMPLE');
  const stockIds = stockLines.map((item) => item.stockItemId);

  const stockItems = stockIds.length
    ? await tx.stockItem.findMany({
        where: { id: { in: stockIds }, branchId, status: 'IN_STOCK' },
        select: { id: true, productId: true },
      })
    : [];
  if (stockItems.length !== stockIds.length) {
    const available = new Set(stockItems.map((item) => item.id));
    throw stockConflict('One or more stock items are no longer available', {
      unavailableStockItemIds: stockIds.filter((id) => !available.has(id)),
    });
  }

  if (reservationAllocation) {
    const ownedStockIds = new Set(reservationAllocation.stockItemIds || []);
    const foreignStockIds = stockIds.filter((id) => !ownedStockIds.has(id));
    if (foreignStockIds.length) {
      throw new SalesError(409, 'RESERVATION_STOCK_CONFLICT', 'Sale contains stock items outside the reservation allocation', {
        stockItemIds: foreignStockIds,
      });
    }
  }

  const simpleProductIds = [...new Set(simpleLines.map((item) => item.productId))];
  const products = simpleProductIds.length
    ? await tx.product.findMany({
        where: {
          id: { in: simpleProductIds },
          active: true,
          mode: 'SIMPLE',
          productType: { branchId },
          branchPrice: { some: { branchId, isActive: true } },
        },
        select: {
          id: true,
          mode: true,
          inventoryBehavior: true,
          productConfig: true,
        },
      })
    : [];
  if (products.length !== simpleProductIds.length) {
    const valid = new Set(products.map((product) => product.id));
    throw new SalesError(400, 'SIMPLE_PRODUCT_NOT_SELLABLE', 'One or more simple products are inactive or not SIMPLE', {
      productIds: simpleProductIds.filter((id) => !valid.has(id)),
    });
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const trackedSimpleLines = simpleLines.filter(
    (line) => productInventoryBehavior(productById.get(line.productId)) === 'TRACKED'
  );
  const nonStockSimpleLines = simpleLines.filter(
    (line) => productInventoryBehavior(productById.get(line.productId)) === 'NON_STOCK'
  );

  const missingLotLines = trackedSimpleLines.filter((line) => !line.simpleLotId);
  if (missingLotLines.length) {
    throw new SalesError(400, 'SIMPLE_LOT_REQUIRED', 'Tracked simple products require simpleLotId', {
      lineIds: missingLotLines.map((line) => line.lineId),
    });
  }

  const lotIds = [...new Set(trackedSimpleLines.map((line) => line.simpleLotId))];
  const lots = lotIds.length
    ? await tx.simpleLot.findMany({
        where: { id: { in: lotIds }, branchId },
        select: { id: true, productId: true, branchId: true, qtyRemaining: true },
      })
    : [];
  const lotById = new Map(lots.map((lot) => [lot.id, lot]));

  const requiredByLot = new Map();
  for (const line of trackedSimpleLines) {
    const lot = lotById.get(line.simpleLotId);
    if (!lot || lot.productId !== line.productId) {
      throw new SalesError(400, 'SIMPLE_LOT_MISMATCH', 'Simple lot does not belong to the selected product and branch', {
        lineId: line.lineId,
        productId: line.productId,
        simpleLotId: line.simpleLotId,
      });
    }
    requiredByLot.set(line.simpleLotId, (requiredByLot.get(line.simpleLotId) || 0) + line.quantity);
  }
  for (const [lotId, required] of requiredByLot.entries()) {
    if (Number(lotById.get(lotId)?.qtyRemaining || 0) + 0.0001 < required) {
      throw stockConflict('Simple lot quantity is no longer available', { simpleLotId: lotId, required });
    }
  }

  const trackedProductIds = [...new Set(trackedSimpleLines.map((line) => line.productId))];
  const balances = trackedProductIds.length
    ? await tx.stockBalance.findMany({
        where: { branchId, productId: { in: trackedProductIds } },
        select: { id: true, productId: true, quantity: true, reserved: true },
      })
    : [];
  const balanceByProduct = new Map(balances.map((balance) => [balance.productId, balance]));
  const requiredByProduct = new Map();
  for (const line of trackedSimpleLines) {
    requiredByProduct.set(line.productId, (requiredByProduct.get(line.productId) || 0) + line.quantity);
  }
  for (const [productId, required] of requiredByProduct.entries()) {
    const balance = balanceByProduct.get(productId);
    const ownedReserved = Number(reservationAllocation?.simpleByProduct?.get(productId) || 0);
    const available = Number(balance?.quantity || 0) - Number(balance?.reserved || 0) + ownedReserved;
    if (!balance || available + 0.0001 < required || ownedReserved + 0.0001 < (reservationAllocation ? required : 0)) {
      throw new SalesError(409, reservationAllocation ? 'RESERVATION_STOCK_CONFLICT' : 'SALE_STOCK_CONFLICT', 'Simple product quantity is no longer available', {
        productId,
        required,
        available,
        ownedReserved,
      });
    }
  }

  return {
    stockLines,
    simpleLines,
    trackedSimpleLines,
    nonStockSimpleLines,
    stockItems,
    stockIds,
    productById,
    lotById,
    requiredByLot,
    requiredByProduct,
  };
};

const loadReservationAllocation = async ({ tx, reservationId, branchId }) => {
  const reservations = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "ProductReservation"
    WHERE "id" = ${reservationId} AND "branchId" = ${branchId}
    FOR UPDATE
  `);
  const reservation = reservations[0];
  if (!reservation) throw new SalesError(404, 'RESERVATION_NOT_FOUND', 'Product reservation was not found');
  if (reservation.convertedSaleId != null) {
    return { reservation, alreadyConverted: true, stockItemIds: [], simpleByProduct: new Map(), items: [] };
  }
  if (!['ACTIVE', 'PARTIALLY_PAID', 'READY_FOR_PICKUP'].includes(reservation.status)) {
    throw new SalesError(409, 'RESERVATION_NOT_CONVERTIBLE', 'Reservation cannot be converted from its current status', {
      status: reservation.status,
    });
  }
  if (Number(reservation.depositAmount || 0) > 0) {
    throw new SalesError(409, 'RESERVATION_DEPOSIT_NOT_POSTED', 'Reservation deposit requires posted payment evidence before conversion');
  }
  const items = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "ProductReservationItem"
    WHERE "reservationId" = ${reservationId} AND "isActive" = TRUE
    ORDER BY "id" ASC
    FOR UPDATE
  `);
  if (!items.length) throw new SalesError(409, 'RESERVATION_ITEMS_MISSING', 'Reservation has no active items');
  const stockItemIds = items.filter((item) => item.lineType === 'STOCK_ITEM').map((item) => Number(item.stockItemId));
  const simpleByProduct = new Map();
  for (const item of items) {
    if (item.lineType === 'SIMPLE') {
      const productId = Number(item.productId);
      simpleByProduct.set(productId, (simpleByProduct.get(productId) || 0) + Number(item.quantity));
    }
  }
  return { reservation, alreadyConverted: false, stockItemIds, simpleByProduct, items };
};

const completeSale = async ({ command, branchId, employeeId, completionContext = null }) => {
  const replay = await loadVerifiedReplay({
    branchId,
    commandKey: command.commandKey,
    requestHash: command.requestHash,
  });
  if (replay) return replay;

  let lastError;
  for (let attempt = 0; attempt <= SALE_CODE_MAX_RETRY; attempt += 1) {
    try {
      await runCompletionTransaction(async (tx) => {
        const reservationAllocation = completionContext?.sourceType === 'PRODUCT_RESERVATION'
          ? await loadReservationAllocation({ tx, reservationId: completionContext.reservationId, branchId })
          : null;
        if (reservationAllocation?.alreadyConverted) {
          throw new SalesError(409, 'RESERVATION_ALREADY_CONVERTED', 'Reservation has already been converted', {
            saleId: Number(reservationAllocation.reservation.convertedSaleId),
          });
        }

        const customer = command.sale.customerId
          ? await tx.customerProfile.findFirst({
              where: { id: command.sale.customerId },
              select: { id: true, paymentTerms: true, type: true },
            })
          : null;
        if (command.sale.customerId && !customer) {
          throw new SalesError(400, 'CUSTOMER_NOT_FOUND', 'Customer not found');
        }

        const evidence = await prepareMixedSaleEvidence({
          tx,
          items: command.sale.items,
          branchId,
          reservationAllocation,
        });
        const productByStock = new Map(evidence.stockItems.map((item) => [item.id, item.productId]));
        const code = await generateSaleCode(tx, branchId, attempt);
        const dueDate = command.sale.isCredit && Number.isInteger(customer?.paymentTerms)
          ? dayjs().add(customer.paymentTerms, 'day').toDate()
          : null;
        const saleType = command.sale.saleType ||
          (customer?.type === 'GOVERNMENT' ? 'GOVERNMENT' : customer?.type === 'ORGANIZATION' ? 'WHOLESALE' : 'NORMAL');

        const sale = await tx.sale.create({
          data: {
            code,
            branchId,
            employeeId,
            customerId: command.sale.customerId,
            totalBeforeDiscount: D(command.sale.totalBeforeDiscount),
            totalDiscount: D(command.sale.totalDiscount),
            totalAmount: D(command.sale.totalAmount),
            vat: D(command.sale.vat),
            vatRate: D(command.sale.vatRate),
            note: command.sale.note,
            isCredit: command.sale.isCredit,
            isTaxInvoice: command.sale.isTaxInvoice,
            saleType,
            dueDate,
            status: command.sale.isCredit ? CREDIT_SALE_STATUS : 'COMPLETED',
            paid: false,
            paidAmount: D(0),
            statusPayment: 'UNPAID',
            officialDocumentNumber: command.sale.isCredit && command.sale.deliveryNoteMode === 'PRINT' ? `DN-${code}` : null,
            items: evidence.stockLines.length ? {
              create: evidence.stockLines.map((item) => ({
                stockItemId: item.stockItemId,
                basePrice: D(item.basePrice),
                vatAmount: D(item.vatAmount),
                price: D(item.price),
                discount: D(item.discount),
                remark: item.remark,
                documentPrefix: item.documentPrefix,
                documentDescription: item.documentDescription,
                documentSuffix: item.documentSuffix,
              })),
            } : undefined,
            simpleItems: evidence.simpleLines.length ? {
              create: evidence.simpleLines.map((item) => ({
                productId: item.productId,
                simpleLotId: item.simpleLotId,
                quantity: D(item.quantity),
                basePrice: D(item.basePrice),
                vatAmount: D(item.vatAmount),
                price: D(item.price),
                discount: D(item.discount),
                remark: item.remark,
                documentPrefix: item.documentPrefix,
                documentDescription: item.documentDescription,
                documentSuffix: item.documentSuffix,
              })),
            } : undefined,
          },
        });

        if (evidence.stockIds.length) {
          const changed = await tx.stockItem.updateMany({
            where: { id: { in: evidence.stockIds }, branchId, status: 'IN_STOCK' },
            data: { status: 'SOLD', soldAt: new Date() },
          });
          if (changed.count !== evidence.stockIds.length) throw stockConflict('Stock changed during completion');
        }

        for (const [lotId, required] of evidence.requiredByLot.entries()) {
          const changed = await tx.simpleLot.updateMany({
            where: { id: lotId, branchId, qtyRemaining: { gte: D(required) } },
            data: { qtyRemaining: { decrement: D(required) } },
          });
          if (changed.count !== 1) throw stockConflict('Simple lot changed during completion', { simpleLotId: lotId });
        }

        for (const [productId, required] of evidence.requiredByProduct.entries()) {
          const changed = reservationAllocation
            ? await tx.stockBalance.updateMany({
                where: { productId, branchId, quantity: { gte: D(required) }, reserved: { gte: D(required) } },
                data: { quantity: { decrement: D(required) }, reserved: { decrement: D(required) } },
              })
            : await tx.stockBalance.updateMany({
                where: { productId, branchId, quantity: { gte: D(required) } },
                data: { quantity: { decrement: D(required) } },
              });
          if (changed.count !== 1) throw stockConflict('Simple stock balance changed during completion', { productId });
        }

        const movements = [
          ...evidence.stockLines.map((line) => ({
            productId: productByStock.get(line.stockItemId),
            branchId,
            type: 'SALE',
            qty: D(-1),
            stockItemId: line.stockItemId,
            refType: 'SALE',
            refId: sale.id,
            performedByEmployeeId: employeeId,
            note: `Sale ${code}`,
          })),
          ...evidence.trackedSimpleLines.map((line) => ({
            productId: line.productId,
            branchId,
            type: 'SALE',
            qty: D(-line.quantity),
            simpleLotId: line.simpleLotId,
            refType: 'SALE',
            refId: sale.id,
            performedByEmployeeId: employeeId,
            note: `Sale ${code}`,
          })),
        ];
        if (movements.length) await tx.stockMovement.createMany({ data: movements });

        const paymentCode = `PM-C-${sale.id}-${command.requestHash.slice(0, 12)}`;
        await postPaymentEvidence(tx, {
          sale: { ...sale, customerId: command.sale.customerId },
          branchId,
          employeeId,
          payment: command.payment,
          code: paymentCode,
        });
        await tx.salesCompletionCommand.create({
          data: {
            branchId,
            commandKey: command.commandKey,
            requestHash: command.requestHash,
            saleId: sale.id,
          },
        });

        if (reservationAllocation) {
          await tx.productReservationItem.updateMany({
            where: { reservationId: completionContext.reservationId, isActive: true },
            data: { isActive: false },
          });
          await tx.productReservation.update({
            where: { id: completionContext.reservationId },
            data: { status: 'COMPLETED', convertedSaleId: sale.id, completedAt: new Date() },
          });
        }
      });

      const final = await loadVerifiedReplay({
        branchId,
        commandKey: command.commandKey,
        requestHash: command.requestHash,
        replayed: false,
      });
      if (!final) throw new SalesError(500, 'COMPLETION_RESULT_MISSING', 'Completion committed but result could not be loaded');
      return final;
    } catch (error) {
      lastError = error;
      const replayAfterRace = await loadVerifiedReplay({
        branchId,
        commandKey: command.commandKey,
        requestHash: command.requestHash,
      });
      if (replayAfterRace) return replayAfterRace;
      if (error?.code === 'P2002' && String(error?.meta?.target || '').includes('code') && attempt < SALE_CODE_MAX_RETRY) continue;
      throw error;
    }
  }
  throw lastError;
};

module.exports = {
  completeSale,
  loadVerifiedReplay,
  canonicalResult,
  productInventoryBehavior,
  prepareMixedSaleEvidence,
};
