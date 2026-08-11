import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('tax expense evidence completion migration is additive lifecycle authority', () => {
  const migration = read('prisma/migrations/20260811120500_tax_expense_evidence_completion/migration.sql');
  const schema = read('prisma/tax/tax-expense.prisma');
  assert.match(migration, /ALTER TYPE "TaxExpenseLifecycleEventType" ADD VALUE IF NOT EXISTS 'EVIDENCE_VERIFIED'/);
  assert.doesNotMatch(migration, /UPDATE\s+"TaxExpense"/i);
  assert.match(schema, /EVIDENCE_VERIFIED/);
});

test('evidence verification is branch scoped, immutable after submit and append-only audited', () => {
  const service = read('src/modules/tax-expense/evidence/taxExpenseEvidenceService.js');
  assert.match(service, /id: Number\(taxExpenseId\), branchId: Number\(branchId\)/);
  assert.match(service, /status: 'SUBMITTED'/);
  assert.match(service, /evidenceStatus: 'VERIFIED'/);
  assert.match(service, /eventType: 'EVIDENCE_VERIFIED'/);
  assert.match(service, /actorEmployeeId: Number\(employeeId\)/);
  assert.match(service, /HUMAN_CONFIRMED_TAX_EXPENSE_EVIDENCE/);
  assert.match(service, /replayed: true/);
});

test('tax expense router exposes explicit evidence verification endpoint', () => {
  const routes = read('src/modules/tax-expense/routes/taxExpenseRoutes.js');
  const controller = read('src/modules/tax-expense/evidence/taxExpenseEvidenceController.js');
  assert.match(routes, /\/:taxExpenseId\/evidence\/verify/);
  assert.match(routes, /taxExpenseEvidence\.verify/);
  assert.match(controller, /branchIdFromToken/);
  assert.match(controller, /employeeIdFromToken/);
});
