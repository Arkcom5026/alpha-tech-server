'use strict';

const fs = require('fs');
const path = require('path');
const { buildIssuedSnapshot } = require('../src/modules/quotation/quotationIssuedSnapshot');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const schema = read('prisma/commerce/quotation.prisma');
const migration = read('prisma/migrations/20260818233000_quotation_issued_snapshot_authority/migration.sql');
const service = read('src/modules/quotation/quotationService.js');

if (!schema.includes('issuedSnapshot         Json?')) throw new Error('Quotation schema must own immutable issuedSnapshot authority');
if (!migration.includes('ADD COLUMN "issuedSnapshot" JSONB')) throw new Error('Issued snapshot migration must add JSONB authority');
if (!service.includes("QUOTATION_ISSUE_CUSTOMER_REQUIRED")) throw new Error('Issue authority must require a recipient');
if (!service.includes("QUOTATION_ISSUE_LINE_REQUIRED")) throw new Error('Issue authority must require at least one document line');
if (!service.includes('quotation = await recalculate(')) throw new Error('Issue authority must recalculate totals immediately before freezing');
if (!service.includes('issuedSnapshot = buildIssuedSnapshot')) throw new Error('Issue authority must build the immutable document snapshot');
if (!service.includes('issuedSnapshot,')) throw new Error('Issue authority must persist the immutable document snapshot');
if (!service.includes("QUOTATION_ISSUED_SNAPSHOT_REQUIRED")) throw new Error('Post-issue lifecycle must require the issued snapshot');
if (service.includes("const issue = transition({ action: 'issue'")) throw new Error('Issue must not use the generic transition path');

const issuedAt = new Date('2026-08-18T16:30:00.000Z');
const quotation = {
  id: 1,
  code: 'QT-6908-00001',
  branchId: 2,
  version: 7,
  issueDate: issuedAt,
  validUntil: new Date('2026-08-31T16:59:59.000Z'),
  subject: 'เสนอราคาอุปกรณ์',
  introduction: null,
  closingNote: 'ยืนราคา 14 วัน',
  notes: null,
  paymentTerms: '30 วัน',
  subtotal: 5500,
  vatEnabled: true,
  vatRate: 7,
  vatAmount: 385,
  grandTotal: 5885,
  items: [{
    id: 10,
    sourceType: 'PRODUCT_ASSISTED',
    sourceProductId: 3766,
    title: 'MONITOR',
    description: null,
    quantity: 1,
    unitName: 'เครื่อง',
    unitPrice: 5500,
    lineSubtotal: 5500,
    lineTotal: 5500,
    sortOrder: 0,
  }],
};
const customerSnapshot = { customerId: 196, company: 'โรงพยาบาลบรรพตพิสัย', address: '700 หมู่ 2 ต.เจริญผล อ.บรรพตพิสัย จ.นครสวรรค์ 60180' };
const documentHeaderSnapshot = { id: 2, name: 'บริษัท แอดวานซ์ เทค บรรพต จำกัด' };
const snapshot = buildIssuedSnapshot({ quotation, customerSnapshot, documentHeaderSnapshot, issuedAt });

if (snapshot.status !== 'ISSUED') throw new Error('Issued snapshot status must be ISSUED');
if (snapshot.version !== 8) throw new Error('Issued snapshot must record the issued document version');
if (snapshot.items.length !== 1 || snapshot.items[0].unitPrice !== 5500) throw new Error('Issued snapshot must freeze commercial line values');
if (snapshot.totals.grandTotal !== 5885 || snapshot.totals.vatAmount !== 385) throw new Error('Issued snapshot must freeze totals and VAT');
if (snapshot.customer.address !== customerSnapshot.address) throw new Error('Issued snapshot must freeze customer presentation');
if (snapshot.documentHeader.name !== documentHeaderSnapshot.name) throw new Error('Issued snapshot must freeze document header presentation');

console.log('Quotation Issued Snapshot Lifecycle Contract: PASS');
