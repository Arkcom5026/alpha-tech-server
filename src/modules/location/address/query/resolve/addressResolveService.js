const addressResolveRepository = require('./addressResolveRepository');
const { addressUtil } = require('../../../../../../utils/address');

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
    result.fullAddress = addressUtil.joinAddress({
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
};
