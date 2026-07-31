const addressResolveRepository = require('./addressResolveRepository');

const joinAddressParts = ({ address, subdistrict, district, province, postalCode }) =>
  [address, subdistrict, district, province, postalCode].filter(Boolean).join(' ');

async function resolveAddress({ subdistrictCode, address, postalCode }) {
  const subdistrict = await addressResolveRepository.findSubdistrictAggregate(subdistrictCode);
  if (!subdistrict) return null;

  const result = {
    provinceCode: subdistrict.district?.provinceCode,
    districtCode: subdistrict.district?.code,
    subdistrictCode: subdistrict.code,
    subdistrictName: subdistrict.nameTh,
    districtName: subdistrict.district?.nameTh,
    provinceName: subdistrict.district?.province?.nameTh,
    region: subdistrict.district?.province?.region || undefined,
    postalCode: postalCode || subdistrict.postcode || undefined,
  };

  if (address || result.postalCode) {
    result.fullAddress = joinAddressParts({
      address,
      subdistrict: result.subdistrictName,
      district: result.districtName,
      province: result.provinceName,
      postalCode: result.postalCode,
    });
  }

  return result;
}

module.exports = {
  resolveAddress,
  joinAddressParts,
};
