const crypto = require('crypto');

function compactDate(date = new Date()) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function entropy() {
  const timePart = Date.now().toString(36).toUpperCase().slice(-7);
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${timePart}${randomPart}`;
}

function createRepairJobNo(branchId, now = new Date()) {
  return `RE-${Number(branchId)}-${compactDate(now)}-${entropy()}`;
}

function createWarrantyClaimNo(branchId, now = new Date()) {
  return `WC-${Number(branchId)}-${compactDate(now)}-${entropy()}`;
}

module.exports = {
  createRepairJobNo,
  createWarrantyClaimNo,
};
