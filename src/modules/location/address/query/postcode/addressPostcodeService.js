const addressPostcodeRepository = require('./addressPostcodeRepository');

const getPostcodeBySubdistrictCode = async (subdistrictCode) => {
  return addressPostcodeRepository.findSubdistrictPostcodeByCode(subdistrictCode);
};

module.exports = { getPostcodeBySubdistrictCode };
