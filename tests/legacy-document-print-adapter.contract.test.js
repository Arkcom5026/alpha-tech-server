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

  it('fails closed when print route is unavailable', async () => {
    await assert.rejects(
      () => createLegacyDocumentPrintJob(
        {
          documentPurposeCode: 'FULL_TAX_INVOICE',
        },
        {
          resolveRoute: async () => ({
            routeStatus: 'UNAVAILABLE',
          }),
          createPrintJob: async () => {
            throw new Error('must not create print job');
          },
        },
      ),
      /PRINT_ROUTE_UNAVAILABLE/,
    );
  });

  it('does not allow caller printer override without resolved authority', async () => {
    await assert.rejects(
      () => createLegacyDocumentPrintJob(
        {
          documentPurposeCode: 'FULL_TAX_INVOICE',
          deviceId: 999,
        },
        {
          resolveRoute: async () => ({
            routeStatus: 'UNAVAILABLE',
          }),
          createPrintJob: async () => ({
            created: true,
          }),
        },
      ),
      /PRINT_ROUTE_UNAVAILABLE/,
    );
  });
});
