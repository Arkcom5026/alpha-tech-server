'use strict';

const { prisma } = require('../../../../lib/prisma');

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

class TaxExpenseEvidenceService {
  constructor(client = prisma) { this.prisma = client; }

  async verify({ branchId, employeeId, taxExpenseId, note }) {
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.taxExpense.findFirst({
        where: { id: Number(taxExpenseId), branchId: Number(branchId) },
      });
      if (!expense) fail('TAX_EXPENSE_NOT_FOUND', 'ไม่พบรายการค่าใช้จ่ายในร้านนี้', 404);
      if (expense.status === 'VOIDED') fail('TAX_EXPENSE_EVIDENCE_VOIDED', 'รายการค่าใช้จ่ายที่ยกเลิกแล้วไม่สามารถยืนยันหลักฐานได้', 409);

      const submittedPeriod = await tx.taxPeriod.findFirst({
        where: {
          branchId: Number(branchId),
          status: 'SUBMITTED',
          startDate: { lte: expense.expenseDate },
          endDate: { gte: expense.expenseDate },
        },
        select: { periodCode: true },
      });
      if (submittedPeriod) {
        fail('TAX_EXPENSE_EVIDENCE_PERIOD_IMMUTABLE', `รอบภาษี ${submittedPeriod.periodCode} ถูกยื่นแล้วและห้ามแก้สถานะหลักฐาน`, 409);
      }

      if (expense.evidenceStatus === 'VERIFIED') {
        const latestEvent = await tx.taxExpenseLifecycleEvent.findFirst({
          where: { taxExpenseId: expense.id, eventType: 'EVIDENCE_VERIFIED' },
          orderBy: { occurredAt: 'desc' },
        });
        return { replayed: true, expense, evidenceEvent: latestEvent || null };
      }

      const updated = await tx.taxExpense.updateMany({
        where: {
          id: expense.id,
          branchId: Number(branchId),
          evidenceStatus: expense.evidenceStatus,
        },
        data: { evidenceStatus: 'VERIFIED' },
      });
      if (Number(updated?.count || 0) !== 1) {
        fail('TAX_EXPENSE_EVIDENCE_CONCURRENT_MODIFICATION', 'สถานะหลักฐานเปลี่ยนระหว่างการยืนยัน กรุณาโหลดใหม่', 409);
      }

      const evidenceEvent = await tx.taxExpenseLifecycleEvent.create({
        data: {
          taxExpenseId: expense.id,
          eventType: 'EVIDENCE_VERIFIED',
          previousStatus: expense.status,
          resultingStatus: expense.status,
          actorEmployeeId: Number(employeeId),
          reasonCode: 'TAX_EXPENSE_EVIDENCE_CONFIRMED',
          note: note ? String(note).trim() || null : null,
          metadata: {
            previousEvidenceStatus: expense.evidenceStatus,
            resultingEvidenceStatus: 'VERIFIED',
            authority: 'HUMAN_CONFIRMED_TAX_EXPENSE_EVIDENCE',
          },
        },
      });

      const refreshed = await tx.taxExpense.findFirst({
        where: { id: expense.id, branchId: Number(branchId) },
      });
      return { replayed: false, expense: refreshed, evidenceEvent };
    });
  }
}

module.exports = { TaxExpenseEvidenceService };
