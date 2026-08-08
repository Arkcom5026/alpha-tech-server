const { createDocumentPrintJob } = require('./createDocumentPrintJobService');

async function createLegacyDocumentPrintJob(request, dependencies = {}) {
  return createDocumentPrintJob(
    request,
    dependencies,
  );
}

module.exports = {
  createLegacyDocumentPrintJob,
};
