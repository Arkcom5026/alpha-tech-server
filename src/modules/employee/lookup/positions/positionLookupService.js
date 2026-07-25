const positionLookupRepository = require('./positionLookupRepository');

const listPositions = () => positionLookupRepository.listPositions();

module.exports = { listPositions };
