const normalize = (value) => (
  value === undefined || value === null ? '' : String(value).trim()
);

const normalizeEmail = (value) => normalize(value).toLowerCase();

const parseRememberMe = (value) => (
  value === true || value === 'true' || value === 1 || value === '1'
);

const onlyDigits = (value) => String(value || '')
  .split('')
  .filter((character) => character >= '0' && character <= '9')
  .join('');

const toE164TH = (digits) => {
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length === 10) {
    return `+66${digits.slice(1)}`;
  }
  return digits;
};

const looksLikeEmail = (value) => String(value || '').includes('@');

module.exports = {
  normalize,
  normalizeEmail,
  parseRememberMe,
  onlyDigits,
  toE164TH,
  looksLikeEmail,
};
