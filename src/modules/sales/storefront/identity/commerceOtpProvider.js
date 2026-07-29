'use strict';

const crypto = require('crypto');

const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const generateChallengeSecret = () => crypto.randomBytes(32).toString('base64url');

const hashOtp = ({ challengeSecret, otp }) => crypto
  .createHmac('sha256', String(challengeSecret))
  .update(String(otp))
  .digest('hex');

const verifyOtp = ({ challengeSecret, otp, expectedHash }) => {
  const actual = Buffer.from(hashOtp({ challengeSecret, otp }), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const sendOtp = async ({ phoneNormalized, otp }) => {
  if (process.env.NODE_ENV === 'production') {
    throw Object.assign(new Error('Commerce OTP provider is not configured'), {
      statusCode: 503,
      code: 'COMMERCE_OTP_PROVIDER_NOT_CONFIGURED',
    });
  }

  console.info('[commerce-otp] development delivery', {
    phoneMasked: `${phoneNormalized.slice(0, 3)}*****${phoneNormalized.slice(-2)}`,
    otp,
  });

  return { provider: 'DEVELOPMENT_CONSOLE', accepted: true };
};

module.exports = Object.freeze({
  generateOtp,
  generateChallengeSecret,
  hashOtp,
  verifyOtp,
  sendOtp,
});
