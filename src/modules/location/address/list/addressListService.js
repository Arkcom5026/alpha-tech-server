const addressListRepository = require('./addressListRepository');

async function getProvinces() {
  return addressListRepository.listProvinces();
}

async function getDistricts(provinceCode) {
  return addressListRepository.listDistrictsByProvinceCode(provinceCode);
}

async function getSubdistricts(districtCode) {
  return addressListRepository.listSubdistrictsByDistrictCode(districtCode);
}

module.exports = {
  getProvinces,
  getDistricts,
  getSubdistricts,
};
