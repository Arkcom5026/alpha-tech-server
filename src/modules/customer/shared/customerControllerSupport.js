const toInt = (value) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

const omitUndefined = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

const normalizePhone = (raw = '') =>
  String(raw).replace(/\D/g, '').replace(/^66/, '0').slice(-10);

const isValidPhone = (value = '') => /^\d{9,10}$/.test(value);

const buildCustomerAddress = (profile) => {
  const parts = [];
  if (profile?.addressDetail) parts.push(profile.addressDetail);

  const subdistrict = profile?.subdistrict;
  const district = subdistrict?.district;
  const province = district?.province;

  if (subdistrict?.nameTh) parts.push(subdistrict.nameTh);
  if (district?.nameTh) parts.push(district.nameTh);
  if (province?.nameTh) parts.push(province.nameTh);

  const postcode = subdistrict?.postcode || profile?.postalCode || null;
  if (postcode) parts.push(postcode);

  return parts.filter(Boolean).join(' ');
};

module.exports = {
  toInt,
  omitUndefined,
  normalizePhone,
  isValidPhone,
  buildCustomerAddress,
};
