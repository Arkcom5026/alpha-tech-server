'use strict';

const { parseCompleteSaleCommand } = require('../../completion/contracts/saleCompletionContract');
const { completeSale } = require('../../completion/services/saleCompletionService');
const repository = require('./productReservationConvertRepository');

const fail = (statusCode, code, message, details) => {
  throw Object.assign(new Error(message), { statusCode, code, details });
};

const positiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(400, 'RESERVATION_INPUT_INVALID', `${fieldName} must be a positive integer`);
  return parsed;
};

const convertProductReservationToSale = async (input = {}, authority = {}) => {
  const reservationId = positiveInt(authority.reservationId, 'reservationId');
  const branchId = positiveInt(authority.branchId, 'branchId');
  const employeeId = positiveInt(authority.employeeId, 'employeeId');
  const reservation = await repository.loadForConversion({ id: reservationId, branchId });
  if (!reservation) fail(404, 'RESERVATION_NOT_FOUND', 'Product reservation was not found');

  const isConverted = reservation.convertedSaleId != null;
  if (reservation.status === 'COMPLETED' && !isConverted) {
    fail(409, 'RESERVATION_INCONSISTENT_STATE', 'Completed reservation is missing its converted sale reference');
  }
  if (!isConverted && !['ACTIVE', 'PARTIALLY_PAID', 'READY_FOR_PICKUP'].includes(reservation.status)) {
    fail(409, 'RESERVATION_NOT_CONVERTIBLE', 'Reservation cannot be converted from its current status', { status: reservation.status });
  }
  if (!reservation.items.length) fail(409, 'RESERVATION_ITEMS_MISSING', 'Reservation has no conversion evidence');
  if (!isConverted && reservation.depositAmount > 0) {
    fail(409, 'RESERVATION_DEPOSIT_NOT_POSTED', 'Reservation deposit requires posted payment evidence before conversion');
  }

  const commandId = String(input.commandId || authority.commandId || `reservation-convert-${reservationId}`).trim();
  const mode = String(input.mode || 'CASH').trim().toUpperCase();
  const vatRate = Number(input.vatRate == null ? 7 : input.vatRate);
  const vat = Number((reservation.totalAmount * vatRate / (100 + vatRate)).toFixed(2));
  const rawCommand = {
    commandId,
    sale: {
      customerId: reservation.customerId,
      mode,
      totalBeforeDiscount: reservation.totalBeforeDiscount,
      totalDiscount: reservation.totalDiscount,
      totalAmount: reservation.totalAmount,
      vat,
      vatRate,
      note: reservation.note ? `Reservation ${reservation.code}\n${reservation.note}` : `Reservation ${reservation.code}`,
      isTaxInvoice: !!input.isTaxInvoice,
      saleType: input.saleType,
      deliveryNoteMode: input.deliveryNoteMode,
      items: reservation.items,
    },
    payment: input.payment || { paymentItems: [] },
  };
  const command = parseCompleteSaleCommand(rawCommand);
  const result = await completeSale({
    command,
    branchId,
    employeeId,
    completionContext: {
      sourceType: 'PRODUCT_RESERVATION',
      reservationId,
    },
  });

  return {
    ...result,
    reservation: {
      id: reservationId,
      code: reservation.code,
      status: 'COMPLETED',
      convertedSaleId: result.saleId,
    },
  };
};

module.exports = Object.freeze({ convertProductReservationToSale });
