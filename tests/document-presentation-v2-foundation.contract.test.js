'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readPrismaSchemaSource } = require('../scripts/read-prisma-schema-source');
const {
  aliasesForCanonicalDocumentCode,
  toCanonicalDocumentCode,
} = require('../src/modules/document-presentation/canonicalDocumentIdentity');
const {
  canStoreConfigureBlock,
  getDocumentPresentationCapability,
} = require('../src/modules/document-presentation/presentationCapabilityRegistry');
const {
  bridgeV1DocumentHeaderConfig,
  collectPaymentAccountIds,
  normalizeDocumentPresentationConfig,
  resolveDocumentPresentation,
} = require('../src/modules/document-presentation/presentationConfig');
const { createPresentationSnapshotEnvelope } = require('../src/modules/document-presentation/presentationSnapshot');
const { normalizeInput } = require('../src/modules/finance/store-payment-account/storePaymentAccountService');

assert.equal(toCanonicalDocumentCode('receipt'), 'SALE_RECEIPT');
assert.equal(toCanonicalDocumentCode('short-tax-receipt'), 'SHORT_TAX_INVOICE');
assert.ok(aliasesForCanonicalDocumentCode('SALE_RECEIPT').includes('RECEIPT'));

assert.equal(getDocumentPresentationCapability('QUOTATION').className, 'COMMERCIAL');
assert.equal(canStoreConfigureBlock('QUOTATION', 'PAYMENT_ACCOUNT'), true);
assert.equal(canStoreConfigureBlock('FULL_TAX_INVOICE', 'TOTALS'), false);
assert.equal(canStoreConfigureBlock('FULL_TAX_INVOICE', 'CUSTOM_FOOTER'), true);

const bridged = bridgeV1DocumentHeaderConfig({
  version: 1,
  default: { logoPosition: 'center', logoSize: 'lg', storeName: 'Alpha' },
  documents: { RECEIPT: { textAlign: 'right' } },
});
assert.equal(bridged.version, 2);
assert.equal(bridged.shared.header.logoPosition, 'center');
assert.equal(bridged.shared.header.logoSize, 72);
assert.equal(bridged.documents.SALE_RECEIPT.header.textAlign, 'right');

const normalized = normalizeDocumentPresentationConfig({
  version: 2,
  shared: {
    typography: { body: 'lg', bad: 'gigantic' },
    blocks: { CUSTOM_FOOTER: { visible: true, content: 'ขอบคุณ', typography: 'sm' } },
    paymentAccountSelection: { accountIds: [2, 3, 3] },
  },
  documents: {
    QUOTATION: {
      paymentAccountSelection: { accountIds: [1, 2, 2, -1], showBankName: true },
    },
  },
});
assert.deepEqual(normalized.shared.typography, { body: 'lg' });
assert.deepEqual(normalized.documents.QUOTATION.paymentAccountSelection.accountIds, [1, 2]);
assert.deepEqual(collectPaymentAccountIds(normalized), [1, 2, 3]);

const resolved = resolveDocumentPresentation({
  systemDefault: { version: 2, shared: { typography: { body: 'sm' } } },
  storeConfig: normalized,
  documentPurpose: 'quotation',
  perDocumentOverride: { typography: { body: 'xl' } },
});
assert.equal(resolved.documentPurpose, 'QUOTATION');
assert.equal(resolved.resolved.typography.body, 'xl');
assert.equal(resolved.resolved.blocks.CUSTOM_FOOTER.content, 'ขอบคุณ');
assert.deepEqual(resolved.resolved.paymentAccountSelection.accountIds, [1, 2]);

const statutory = resolveDocumentPresentation({
  storeConfig: {
    version: 2,
    shared: {
      blocks: {
        TOTALS: { visible: false, content: 'forbidden override' },
        CUSTOM_FOOTER: { visible: true, content: 'allowed footer' },
      },
      paymentAccountSelection: { accountIds: [1] },
    },
  },
  documentPurpose: 'FULL_TAX_INVOICE',
});
assert.equal(statutory.resolved.blocks.TOTALS, undefined);
assert.equal(statutory.resolved.blocks.CUSTOM_FOOTER.content, 'allowed footer');
assert.equal(statutory.resolved.paymentAccountSelection, undefined);

const snapshot = createPresentationSnapshotEnvelope({
  businessSnapshot: { documentNo: 'Q-001' },
  presentation: resolved,
  documentPurpose: 'QUOTATION',
  rendererFamily: 'A4',
  issuedAt: '2026-08-19T05:00:00.000Z',
});
assert.equal(snapshot.snapshotHash.length, 64);
assert.equal(snapshot.documentPurpose, 'QUOTATION');
const sameSnapshot = createPresentationSnapshotEnvelope({
  businessSnapshot: { documentNo: 'Q-001' },
  presentation: resolved,
  documentPurpose: 'QUOTATION',
  rendererFamily: 'A4',
  issuedAt: '2026-08-19T05:00:00.000Z',
});
assert.equal(snapshot.snapshotHash, sameSnapshot.snapshotHash);

const issuedResolution = resolveDocumentPresentation({
  storeConfig: { version: 2, shared: { typography: { body: 'xs' } } },
  documentPurpose: 'QUOTATION',
  issuedSnapshot: { presentation: resolved },
});
assert.deepEqual(issuedResolution, resolved);

const account = normalizeInput({
  code: ' transfer-main ',
  displayName: 'บัญชีหลัก',
  bankName: 'ธนาคารตัวอย่าง',
  accountName: 'บริษัท อัลฟ่า จำกัด',
  accountNumber: '123-4-56789-0',
});
assert.equal(account.code, 'TRANSFER-MAIN');
assert.equal(account.accountNumber, '123-4-56789-0');

const root = path.resolve(__dirname, '..');
const schema = readPrismaSchemaSource(root);
assert.match(schema, /model StorePaymentAccount \{/);
assert.match(schema, /storePaymentAccounts\s+StorePaymentAccount\[\]/);
assert.match(schema, /@@unique\(\[branchId, code\]\)/);
assert.match(schema, /branch Branch @relation\(fields: \[branchId\], references: \[id\], onDelete: Restrict\)/);

const migration = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260819130000_store_payment_account_foundation/migration.sql'),
  'utf8',
);
assert.match(migration, /CREATE TABLE "StorePaymentAccount"/);
assert.match(migration, /ON DELETE RESTRICT/);
assert.doesNotMatch(migration, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE)\b/im);

const branchRuntimeSource = fs.readFileSync(
  path.join(root, 'src/modules/branch/runtime/branchRuntimeService.js'),
  'utf8',
);
assert.match(branchRuntimeSource, /Number\(value\.version\) === 2/);
assert.match(branchRuntimeSource, /assertStorePaymentAccountsOwnedByBranch/);
assert.match(branchRuntimeSource, /collectPaymentAccountIds/);

const financeRoutesSource = fs.readFileSync(
  path.join(root, 'src/modules/finance/routes/financeRuntimeRoutes.js'),
  'utf8',
);
assert.match(financeRoutesSource, /store-payment-accounts/);
const accountRoutesSource = fs.readFileSync(
  path.join(root, 'src/modules/finance/store-payment-account/storePaymentAccountRoutes.js'),
  'utf8',
);
assert.match(accountRoutesSource, /router\.post\('\/', requireAdmin/);
assert.match(accountRoutesSource, /router\.patch\('\/:id', requireAdmin/);

console.log('Document Presentation V2 Wave 0 foundation contract: PASS');
