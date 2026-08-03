const crypto = require('node:crypto');

const TOKEN_TTL_SECONDS = Math.max(
  60,
  Number(process.env.CUSTOMER_FIRST_ASSOCIATION_TTL_SECONDS || 900)
);

const secret = () =>
  String(
    process.env.CUSTOMER_FIRST_ASSOCIATION_SECRET ||
      process.env.JWT_SECRET ||
      process.env.ACCESS_TOKEN_SECRET ||
      ''
  );

const encode = (value) => Buffer.from(value).toString('base64url');
const decode = (value) => Buffer.from(value, 'base64url').toString('utf8');

const sign = (payload) => {
  const key = secret();
  if (!key) throw new Error('CUSTOMER_FIRST_ASSOCIATION_SECRET_REQUIRED');
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
};

function issueCustomerFirstAssociationToken({ customerId, branchId, employeeId, now = Date.now() }) {
  const claims = {
    purpose: 'SALE_CUSTOMER_FIRST_ASSOCIATION',
    customerId: Number(customerId),
    branchId: Number(branchId),
    employeeId: Number(employeeId),
    issuedAt: Math.floor(now / 1000),
    expiresAt: Math.floor(now / 1000) + TOKEN_TTL_SECONDS,
  };
  const payload = encode(JSON.stringify(claims));
  return `${payload}.${sign(payload)}`;
}

function verifyCustomerFirstAssociationToken(token, expected = {}, now = Date.now()) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return false;

  const expectedSignature = sign(payload);
  const supplied = Buffer.from(signature);
  const calculated = Buffer.from(expectedSignature);
  if (supplied.length !== calculated.length || !crypto.timingSafeEqual(supplied, calculated)) {
    return false;
  }

  let claims;
  try {
    claims = JSON.parse(decode(payload));
  } catch {
    return false;
  }

  const current = Math.floor(now / 1000);
  return Boolean(
    claims?.purpose === 'SALE_CUSTOMER_FIRST_ASSOCIATION' &&
      claims.expiresAt >= current &&
      Number(claims.customerId) === Number(expected.customerId) &&
      Number(claims.branchId) === Number(expected.branchId) &&
      Number(claims.employeeId) === Number(expected.employeeId)
  );
}

module.exports = {
  issueCustomerFirstAssociationToken,
  verifyCustomerFirstAssociationToken,
  TOKEN_TTL_SECONDS,
};
