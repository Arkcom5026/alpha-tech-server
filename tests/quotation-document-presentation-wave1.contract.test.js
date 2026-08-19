'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildIssuedSnapshot } = require('../src/modules/quotation/quotationIssuedSnapshot');
const {
  buildQuotationPresentationSnapshot,
} = require('../src/modules/quotation/quotationPresentationSnapshot');

const main = async () => {
  const accountRows = [
    {
      id: 7,
      code: 'BANK-B',
      displayName: 'บัญชีสำรอง',
      bankName: 'ธนาคาร B',
      accountName: 'บริษัท ตัวอย่าง จำกัด',
      accountNumber: '222-2-22222-2',
      accountType: 'CURRENT',
      promptPayId: null,
    },
    {
      id: 3,
      code: 'BANK-A',
      displayName: 'บัญชีหลัก',
      bankName: 'ธนาคาร A',
      accountName: 'บริษัท ตัวอย่าง จำกัด',
      accountNumber: '111-1-11111-1',
      accountType: 'SAVINGS',
      promptPayId: '0100000000000',
    },
  ];

  const tx = {
    storePaymentAccount: {
      findMany: async ({ where }) => {
        assert.equal(where.branchId, 14);
        assert.equal(where.isActive, true);
        assert.deepEqual(where.id.in, [3, 7]);
        return accountRows;
      },
    },
  };

  const branch = {
    id: 14,
    documentHeaderConfig: {
      version: 2,
      shared: {
        typography: { body: 'md' },
      },
      documents: {
        QUOTATION: {
          blocks: {
            PAYMENT_TERMS: { visible: true, content: 'ชำระ 50% ก่อนเริ่มงาน' },
            CUSTOM_FOOTER: { visible: true, content: 'ขอบคุณที่ไว้วางใจ' },
          },
          paymentAccountSelection: {
            accountIds: [3, 7],
            showBankName: true,
            showAccountName: true,
            showAccountNumber: true,
          },
        },
      },
    },
  };

  const quotation = { id: 99, code: 'QT-001', revisionNumber: 0 };
  const issuedAt = '2026-08-19T06:30:00.000Z';
  const composed = await buildQuotationPresentationSnapshot({ tx, branch, quotation, issuedAt });

  assert.equal(composed.presentationSnapshot.documentPurpose, 'QUOTATION');
  assert.equal(composed.presentationSnapshot.rendererFamily, 'A4');
  assert.equal(composed.presentationSnapshot.presentation.resolved.blocks.PAYMENT_TERMS.content, 'ชำระ 50% ก่อนเริ่มงาน');
  assert.deepEqual(composed.paymentAccountSnapshots.map((account) => account.id), [3, 7]);
  assert.equal(composed.paymentAccountSnapshots[0].accountNumber, '111-1-11111-1');
  assert.equal(composed.paymentAccountSnapshots[1].accountNumber, '222-2-22222-2');

  const issued = buildIssuedSnapshot({
    quotation: {
      id: 99,
      code: 'QT-001',
      branchId: 14,
      revisionNumber: 0,
      version: 4,
      grandTotal: 1070,
      vatAmount: 70,
      vatRate: 7,
      vatEnabled: true,
      items: [],
    },
    documentHeaderSnapshot: { id: 14, name: 'ร้านตัวอย่าง' },
    customerSnapshot: { customerId: 8, name: 'ลูกค้า' },
    presentationSnapshot: composed.presentationSnapshot,
    paymentAccountSnapshots: composed.paymentAccountSnapshots,
    issuedAt,
  });

  assert.equal(issued.schemaVersion, 4);
  assert.equal(issued.presentation.snapshotHash.length, 64);
  assert.deepEqual(issued.paymentAccounts.map((account) => account.id), [3, 7]);

  const quotationServiceSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/quotation/quotationService.js'),
    'utf8',
  );
  assert.match(
    quotationServiceSource,
    /buildQuotationPresentationSnapshot/,
    'quotation issue authority must compose presentation inside the service transaction',
  );
  assert.match(
    quotationServiceSource,
    /await buildQuotationPresentationSnapshot\(\{[\s\S]*?tx,[\s\S]*?branch: documentHeaderSnapshot,[\s\S]*?issuedAt,[\s\S]*?\}\)/,
    'quotation issue must resolve presentation and payment account facts using the same transaction',
  );
  assert.match(
    quotationServiceSource,
    /buildIssuedSnapshot\(\{[\s\S]*?presentationSnapshot,[\s\S]*?paymentAccountSnapshots,[\s\S]*?issuedAt,[\s\S]*?\}\)/,
    'issued quotation snapshot must persist presentation and selected payment-account facts together',
  );

  console.log('Quotation Document Presentation Wave 1 contract: PASS');
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
