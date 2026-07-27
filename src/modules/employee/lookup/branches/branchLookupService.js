const branchLookupRepository = require('./branchLookupRepository');

const listBranches = () => branchLookupRepository.listBranches();

module.exports = { listBranches };
