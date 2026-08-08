const assert = require('assert');
const { createDocumentPrintJob } = require('../src/modules/print-job-creation/createDocumentPrintJobService');

describe('Unified Print Job Creation Boundary', () => {
  it('creates print job with resolved target snapshot', async () => {
    const result = await createDocumentPrintJob(
      {
        branchId: 1,
        documentPurposeCode: 'FULL_TAX_INVOICE',
      },
      {
        resolveRoute: async () => ({
          status: 'ACTIVE',
          targetType: 'DEVICE',
          deviceId: 12,
          capability: 'A4',
        }),
        createPrintJob: async (job) => job,
      },
    );

    assert.equal(result.printTargetSnapshot.target.deviceId, 12);
  });

  it('blocks job creation when route is unavailable', async () => {
    await assert.rejects(
      () => createDocumentPrintJob(
        { documentPurposeCode: 'FULL_TAX_INVOICE' },
        {
          resolveRoute: async () => null,
          createPrintJob: async () => {
            throw new Error('must not execute');
          },
        },
      ),
      /PRINT_ROUTE_UNAVAILABLE/,
    );
  });
});
