'use strict';

module.exports = {
  ...require('./canonicalDocumentIdentity'),
  ...require('./presentationCapabilityRegistry'),
  ...require('./presentationConfig'),
  ...require('./presentationSnapshot'),
};
