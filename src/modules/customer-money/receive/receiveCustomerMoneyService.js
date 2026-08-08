'use strict';

const receiveCustomerMoney = async ({
  prisma,
  receiptRepository,
  createLedger,
  updateBalance,
  receiptData,
  ledgerData,
  balanceData,
}) => {
  if (!prisma?.$transaction) {
    throw new TypeError('Prisma transaction client is required');
  }

  return prisma.$transaction(async (tx) => {
    const receipt = await receiptRepository({
      client: tx,
      data: receiptData,
    });

    await createLedger({
      client: tx,
      data: {
        ...ledgerData,
        referenceId: receipt.id,
        referenceType: 'CUSTOMER_MONEY_RECEIPT',
      },
    });

    const balance = await updateBalance({
      client: tx,
      data: balanceData,
    });

    return {
      receipt,
      balance,
    };
  });
};

module.exports = { receiveCustomerMoney };
