const fs = require('fs');
const path = require('path');

const controllerPath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'sales',
  'settlement',
  'controllers',
  'saleSettlementController.js'
);

const source = fs.readFileSync(controllerPath, 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(
  source.includes("code: 'PAYMENT_EVIDENCE_INSUFFICIENT'"),
  'Settlement must preserve PAYMENT_EVIDENCE_INSUFFICIENT code'
);
assert(
  source.includes('status: 409'),
  'Settlement evidence failure must remain a deterministic 409'
);
assert(
  source.includes('const projectedTotalAmount = Number(projection.totalAmount || canonicalTotalAmount);'),
  'Settlement must derive error totals from the canonical payment projection with legacy fallback'
);
assert(
  source.includes('totalAmount: projectedTotalAmount'),
  'Settlement error detail must expose the projected canonical total amount'
);
assert(
  source.includes('paidAmount: projectedPaidAmount'),
  'Settlement error detail must expose projected paid amount'
);
assert(
  source.includes('balanceAmount'),
  'Settlement error detail must expose remaining balance'
);
assert(
  source.includes("return res.status(404).json({ message: 'ไม่พบรายการขายนี้ในสาขาของคุณ' })"),
  'Settlement must preserve branch-scoped not-found response'
);
assert(
  source.includes('if (sendSettlementError(res, error)) return;'),
  'Controller catch must preserve known deterministic settlement errors'
);
assert(
  source.includes("return res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะปิดบิล' })"),
  'Unknown settlement failures must remain generic 500 responses'
);
assert(
  source.indexOf('if (sendSettlementError(res, error)) return;') < source.indexOf("console.error('❌ [markSaleAsPaid]'"),
  'Known settlement errors must be handled before generic logging/500 fallback'
);

console.log('Sale settlement error authority contract: PASS');
