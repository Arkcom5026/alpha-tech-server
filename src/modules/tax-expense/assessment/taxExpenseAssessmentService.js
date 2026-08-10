'use strict';

const crypto = require('node:crypto');
const { prisma } = require('../../../../lib/prisma');

const VAT_TREATMENTS = new Set(['PENDING_REVIEW', 'CREDITABLE', 'NON_CREDITABLE', 'OUT_OF_SCOPE']);
const CIT_TREATMENTS = new Set(['PENDING_REVIEW', 'DEDUCTIBLE', 'NON_DEDUCTIBLE', 'PARTIALLY_DEDUCTIBLE']);

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const canonicalHash = (value) => crypto
  .createHash('sha256')
  .update(JSON.stringify(value))
  .digest('hex');

const vatSuggestionFor = (expense, item) => {
  const vatAmount = Number(item.vatAmount || 0);
  if (vatAmount <= 0) {
    return {
      treatment: 'OUT_OF_SCOPE',
      confidence: 'HIGH',
      reasonCode: 'NO_VAT_AMOUNT_RECORDED',
      reason: 'รายการนี้ไม่มีจำนวน VAT ที่บันทึกไว้',
    };
  }
  if (expense.evidenceStatus === 'VERIFIED' && expense.documentNumber) {
    return {
      treatment: 'CREDITABLE',
      confidence: 'MEDIUM',
      reasonCode: 'VERIFIED_EVIDENCE_WITH_DOCUMENT',
      reason: 'มีจำนวน VAT พร้อมเอกสารและหลักฐานที่ตรวจแล้ว แต่ยังต้องให้ผู้ใช้ยืนยันสิทธิภาษีซื้อ',
    };
  }
  return {
    treatment: 'PENDING_REVIEW',
    confidence: 'LOW',
    reasonCode: 'VAT_EVIDENCE_REVIEW_REQUIRED',
    reason: 'มีจำนวน VAT แต่หลักฐานหรือข้อมูลเอกสารยังไม่เพียงพอสำหรับข้อเสนออัตโนมัติ',
  };
};

const citSuggestionFor = () => ({
  treatment: 'PENDING_REVIEW',
  confidence: 'LOW',
  reasonCode: 'CIT_RULE_AUTHORITY_NOT_CONFIGURED',
  reason: 'ยังไม่มี rule authority ของ CIT สำหรับหมวดนี้ จึงต้องให้ผู้ใช้ประเมิน',
});

const whtSuggestionFor = (item) => Number(item.withholdingTaxAmount || 0) > 0
  ? {
      treatment: item.whtTreatment,
      confidence: 'HIGH',
      reasonCode: 'WHT_WORKFLOW_REVIEW_REQUIRED',
      reason: 'รายการมี WHT และต้องยืนยันผ่าน WHT workflow เพื่อเก็บ audit event',
      action: 'REVIEW_IN_WHT_WORKSPACE',
    }
  : {
      treatment: 'NOT_APPLICABLE',
      confidence: 'HIGH',
      reasonCode: 'NO_WHT_AMOUNT_RECORDED',
      reason: 'ไม่มีจำนวนภาษีหัก ณ ที่จ่ายในรายการนี้',
      action: 'NONE',
    };

const buildSuggestion = (expense) => ({
  taxExpenseId: expense.id,
  expenseNumber: expense.expenseNumber,
  evidenceStatus: expense.evidenceStatus,
  documentNumber: expense.documentNumber,
  generatedAt: new Date().toISOString(),
  authority: 'RULE_ASSISTED_HUMAN_CONFIRMATION',
  autoFinalize: false,
  items: expense.items.map((item) => ({
    taxExpenseItemId: item.id,
    lineNumber: item.lineNumber,
    description: item.description,
    category: item.category,
    current: {
      vatTreatment: item.vatTreatment,
      citTreatment: item.citTreatment,
      whtTreatment: item.whtTreatment,
    },
    suggestions: {
      vat: vatSuggestionFor(expense, item),
      cit: citSuggestionFor(expense, item),
      wht: whtSuggestionFor(item),
    },
  })),
});

class TaxExpenseAssessmentService {
  constructor(client = prisma) { this.prisma = client; }

  async loadExpense(branchId, taxExpenseId, tx = this.prisma) {
    const expense = await tx.taxExpense.findFirst({
      where: { id: taxExpenseId, branchId },
      include: {
        items: {
          include: { category: { select: { id: true, code: true, name: true } } },
          orderBy: { lineNumber: 'asc' },
        },
        assessments: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!expense) fail('TAX_EXPENSE_NOT_FOUND', 'ไม่พบรายการค่าใช้จ่ายในร้านนี้', 404);
    return expense;
  }

  async assertMutablePeriod(expense, branchId, tx) {
    const submittedPeriod = await tx.taxPeriod.findFirst({
      where: {
        branchId,
        status: 'SUBMITTED',
        startDate: { lte: expense.expenseDate },
        endDate: { gte: expense.expenseDate },
      },
      select: { id: true, periodCode: true },
    });
    if (submittedPeriod) {
      fail('TAX_EXPENSE_ASSESSMENT_PERIOD_IMMUTABLE', `รอบภาษี ${submittedPeriod.periodCode} ถูกยื่นแล้วและห้ามแก้ผลการประเมิน`, 409);
    }
  }

  async getSuggestion({ branchId, taxExpenseId }) {
    const expense = await this.loadExpense(branchId, taxExpenseId);
    return {
      suggestion: buildSuggestion(expense),
      latestAssessment: expense.assessments[0] || null,
    };
  }

  async confirm({ branchId, employeeId, taxExpenseId, decisions, note }) {
    if (!Array.isArray(decisions) || decisions.length === 0) {
      fail('TAX_EXPENSE_ASSESSMENT_DECISIONS_REQUIRED', 'ต้องมีผลการประเมินอย่างน้อยหนึ่งรายการ');
    }

    return this.prisma.$transaction(async (tx) => {
      const expense = await this.loadExpense(branchId, taxExpenseId, tx);
      await this.assertMutablePeriod(expense, branchId, tx);
      const itemById = new Map(expense.items.map((item) => [item.id, item]));
      if (decisions.length !== expense.items.length) {
        fail('TAX_EXPENSE_ASSESSMENT_INCOMPLETE', 'ต้องยืนยันผลการประเมินให้ครบทุกรายการ');
      }

      const normalized = decisions.map((decision) => {
        const taxExpenseItemId = Number(decision?.taxExpenseItemId);
        const item = itemById.get(taxExpenseItemId);
        if (!item) fail('TAX_EXPENSE_ASSESSMENT_ITEM_INVALID', 'พบรายการประเมินที่ไม่อยู่ในค่าใช้จ่ายนี้');
        const vatTreatment = String(decision?.vatTreatment || '').trim().toUpperCase();
        const citTreatment = String(decision?.citTreatment || '').trim().toUpperCase();
        if (!VAT_TREATMENTS.has(vatTreatment)) fail('TAX_EXPENSE_ASSESSMENT_VAT_INVALID', 'VAT treatment ไม่ถูกต้อง');
        if (!CIT_TREATMENTS.has(citTreatment)) fail('TAX_EXPENSE_ASSESSMENT_CIT_INVALID', 'CIT treatment ไม่ถูกต้อง');
        return { taxExpenseItemId, vatTreatment, citTreatment };
      });

      if (new Set(normalized.map((row) => row.taxExpenseItemId)).size !== expense.items.length) {
        fail('TAX_EXPENSE_ASSESSMENT_DUPLICATE_ITEM', 'ห้ามส่งผลการประเมินรายการเดิมซ้ำกัน');
      }

      const suggestions = buildSuggestion(expense);
      const previous = expense.assessments[0] || null;
      const version = Number(previous?.version || 0) + 1;
      const snapshot = {
        authority: 'HUMAN_CONFIRMED_RULE_ASSISTED_ASSESSMENT',
        confirmedAt: new Date().toISOString(),
        confirmedByEmployeeId: employeeId,
        suggestions,
        decisions: normalized,
        whtAuthority: 'SEPARATE_WHT_WORKFLOW',
      };
      const assessmentHash = canonicalHash({ taxExpenseId, version, decisions: normalized, note: note || null });

      for (const decision of normalized) {
        const result = await tx.taxExpenseItem.updateMany({
          where: { id: decision.taxExpenseItemId, taxExpenseId, branchId },
          data: { vatTreatment: decision.vatTreatment, citTreatment: decision.citTreatment },
        });
        if (Number(result?.count || 0) !== 1) {
          fail('TAX_EXPENSE_ASSESSMENT_CONCURRENT_MODIFICATION', 'รายการค่าใช้จ่ายเปลี่ยนแปลงระหว่างการยืนยัน กรุณาโหลดใหม่', 409);
        }
      }

      if (previous?.status === 'FINALIZED') {
        await tx.taxExpenseAssessment.update({
          where: { id: previous.id },
          data: { status: 'SUPERSEDED' },
        });
      }

      const aggregateVat = normalized.every((row) => row.vatTreatment === normalized[0].vatTreatment)
        ? normalized[0].vatTreatment : 'PENDING_REVIEW';
      const aggregateCit = normalized.every((row) => row.citTreatment === normalized[0].citTreatment)
        ? normalized[0].citTreatment : 'PENDING_REVIEW';
      const aggregateWht = expense.items.some((item) => Number(item.withholdingTaxAmount || 0) > 0)
        ? 'PENDING_REVIEW' : 'NOT_APPLICABLE';

      const assessment = await tx.taxExpenseAssessment.create({
        data: {
          taxExpenseId,
          version,
          status: 'FINALIZED',
          vatTreatment: aggregateVat,
          citTreatment: aggregateCit,
          whtTreatment: aggregateWht,
          assessmentNote: note ? String(note).trim() || null : null,
          assessmentSnapshot: snapshot,
          assessmentHash,
          assessedByEmployeeId: employeeId,
          assessedAt: new Date(),
        },
      });

      return { assessment, snapshot };
    });
  }
}

module.exports = {
  TaxExpenseAssessmentService,
  buildSuggestion,
  canonicalHash,
};
