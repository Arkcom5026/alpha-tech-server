'use strict';

const {
  projectSalePaymentStatus,
} = require('../../sales/completion/services/salePaymentPostingService');

const buildApplicationError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const createCustomerMoneyApplication = async ({ client, data }) => {
  if (!client?.customerMoneyApplication) {
    throw new TypeError('Customer Money application client is required');
  }

  const isLegacyDepositSaleApplication = (
    data?.sourceType === 'CUSTOMER_DEPOSIT'
    && data?.targetType === 'SALE'
  );

  if (isLegacyDepositSaleApplication) {
    const saleId = Number(data.targetId);
    const branchId = Number(data.branchId);
    const customerId = Number(data.customerId);
    const sale = await client.sale.findFirst({
      where: {
        id: saleId,
        branchId,
        customerId,
        status: { not: 'CANCELLED' },
      },
      select: { id: true },
    });
    if (!sale) {
      throw buildApplicationError(
        'ไม่พบใบขายที่สามารถใช้ Customer Money รายการนี้ได้',
        409,
        'CUSTOMER_MONEY_SALE_NOT_ELIGIBLE',
      );
    }

    const currentPaymentState = await projectSalePaymentStatus(client, saleId);
    const outstandingAmount = Math.max(
      0,
      Number(currentPaymentState.totalAmount || 0) - Number(currentPaymentState.paidAmount || 0),
    );
    if (Number(data.amount || 0) > outstandingAmount + 0.001) {
      throw buildApplicationError(
        'ยอดใช้เงินมัดจำมากกว่ายอดค้างของใบขาย',
        409,
        'CUSTOMER_MONEY_APPLICATION_EXCEEDS_OUTSTANDING',
      );
    }
  }

  const application = await client.customerMoneyApplication.create({ data });

  if (isLegacyDepositSaleApplication) {
    await projectSalePaymentStatus(client, Number(data.targetId));
  }

  return application;
};

module.exports = {
  createCustomerMoneyApplication,
  buildApplicationError,
};
