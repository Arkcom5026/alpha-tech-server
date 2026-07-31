const addressJoinRepository = require('./addressJoinRepository');

const joinAddressParts = ({ address, subdistrict, district, province, postalCode }) =>
  [address, subdistrict, district, province, postalCode].filter(Boolean).join(' ');

const joinAddressBySubdistrictCode = async ({ address, subdistrictCode, postalCode }) => {
  const subdistrict = await addressJoinRepository.findAddressBySubdistrictCode(subdistrictCode);
  if (!subdistrict) return null;

  return joinAddressParts({
    address,
    subdistrict: subdistrict.nameTh,
    district: subdistrict.district?.nameTh,
    province: subdistrict.district?.province?.nameTh,
    postalCode: postalCode || subdistrict.postcode || undefined,
  });
};

module.exports = { joinAddressBySubdistrictCode, joinAddressParts };
