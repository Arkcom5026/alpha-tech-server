const assert = require('assert');
const { createLegacyDocumentPrintJob } = require('../src/modules/print-job-creation/legacyDocumentPrintAdapter');

describe('Legacy Document Print Adapter Boundary', () => {
  it('routes legacy print creation through unified creator', async () => {
    const result = await createLegacyDocumentPrintJob(
      {
        documentPurposeCode: 'SALE_RECEIPT',
      },
      {
        resolveRoute: async () => ({
          routeStatus: 'RESOLVED',
          targetType: 'DEVICE',
          deviceId: 5,
          capability: 'RECEIPT',
        }),
        createPrintJob: async (job) => job,
      },
    );

    assert.equal(result.printTargetSnapshot.target.deviceId, 5);
  });
});
