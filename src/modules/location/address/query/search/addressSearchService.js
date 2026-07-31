const addressSearchRepository = require('./addressSearchRepository');

const searchAddresses = async (query) => {
  if (!query || query.length < 2) {
    return { provinces: [], districts: [], subdistricts: [] };
  }

  return addressSearchRepository.searchAddressEntities(query);
};

module.exports = { searchAddresses };
