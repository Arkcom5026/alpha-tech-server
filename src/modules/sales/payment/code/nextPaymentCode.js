const bangkokNow = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 7 * 60 * 60000);
};

const buildLegacyPaymentCode = ({ branchId, counter }) => {
  const date = bangkokNow();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const bb = String(branchId).padStart(2, '0');
  const rrr = String(counter).padStart(3, '0');
  return `PMT-${bb}${yy}${mm}${rrr}`;
};

const nextPaymentCode = async (tx, branchId) => {
  const date = bangkokNow();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const period = `${yy}${mm}`;
  const bb = String(branchId).padStart(2, '0');
  const prefix = `PMT-${bb}${yy}${mm}`;

  let counter = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const updated = await tx.paymentCodeCounter.update({
        where: { branchId_yyyymmdd: { branchId, yyyymmdd: period } },
        data: { lastNo: { increment: 1 } },
        select: { lastNo: true },
      });
      counter = updated.lastNo;
      break;
    } catch (error) {
      if (error?.code !== 'P2025') throw error;

      const last = await tx.payment.findFirst({
        where: { branchId, code: { startsWith: prefix } },
        orderBy: { code: 'desc' },
        select: { code: true },
      });
      const maxNo = last ? parseInt(String(last.code).slice(prefix.length), 10) || 0 : 0;

      try {
        await tx.paymentCodeCounter.create({
          data: { branchId, yyyymmdd: period, lastNo: maxNo },
          select: { branchId: true },
        });
      } catch (createError) {
        if (createError?.code !== 'P2002') throw createError;
      }
    }
  }

  if (counter == null) throw new Error('GEN_CODE_FAILED');
  return buildLegacyPaymentCode({ branchId, counter });
};

module.exports = {
  nextPaymentCode,
};
