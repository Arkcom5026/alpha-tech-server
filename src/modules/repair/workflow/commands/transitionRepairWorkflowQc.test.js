const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeRepairCompletion,
  normalizeQc,
} = require('./transitionRepairWorkflowService');
const {
  REPAIR_WORKFLOW_ACTION,
} = require('../policies/repairWorkflowPolicy');

test('repair completion requires work performed, result summary and final amount', () => {
  const result = normalizeRepairCompletion(REPAIR_WORKFLOW_ACTION.COMPLETE_REPAIR, {
    workPerformed: 'เปลี่ยน SSD และลงระบบใหม่',
    resultSummary: 'บูตและใช้งานได้ปกติ',
    finalAmount: 1250,
    technicianNote: 'ทดสอบ 2 รอบ',
  });

  assert.deepEqual(result, {
    workPerformed: 'เปลี่ยน SSD และลงระบบใหม่',
    resultSummary: 'บูตและใช้งานได้ปกติ',
    finalAmount: 1250,
    technicianNote: 'ทดสอบ 2 รอบ',
  });

  assert.throws(
    () => normalizeRepairCompletion(REPAIR_WORKFLOW_ACTION.COMPLETE_REPAIR, {
      workPerformed: '',
      resultSummary: 'ok',
      finalAmount: 0,
    }),
    (error) => error.code === 'INVALID_REPAIR_WORKFLOW_COMMAND'
  );
  assert.throws(
    () => normalizeRepairCompletion(REPAIR_WORKFLOW_ACTION.COMPLETE_REPAIR, {
      workPerformed: 'ตรวจและซ่อมแล้ว',
      resultSummary: 'ok',
    }),
    (error) =>
      error.code === 'INVALID_REPAIR_WORKFLOW_COMMAND' &&
      error.details.field === 'repairCompletion.finalAmount'
  );
});

test('PASS_QC requires a non-empty checklist and every check passing', () => {
  assert.throws(
    () => normalizeQc(REPAIR_WORKFLOW_ACTION.PASS_QC, { checks: [] }),
    (error) => error.code === 'INVALID_REPAIR_WORKFLOW_COMMAND'
  );

  assert.throws(
    () => normalizeQc(REPAIR_WORKFLOW_ACTION.PASS_QC, {
      checks: [
        { key: 'function_test', label: 'ฟังก์ชันหลัก', passed: true },
        { key: 'stability_test', label: 'ความเสถียร', passed: false },
      ],
    }),
    (error) => error.code === 'INVALID_REPAIR_WORKFLOW_COMMAND'
  );

  const result = normalizeQc(REPAIR_WORKFLOW_ACTION.PASS_QC, {
    checks: [
      { key: 'function_test', label: 'ฟังก์ชันหลัก', passed: true },
      { key: 'stability_test', label: 'ความเสถียร', passed: true },
    ],
    note: 'ผ่านทุกจุด',
  });
  assert.equal(result.checks.every((item) => item.passed), true);
  assert.equal(result.note, 'ผ่านทุกจุด');
});

test('FAIL_QC preserves failed checklist evidence for rework handoff', () => {
  const result = normalizeQc(REPAIR_WORKFLOW_ACTION.FAIL_QC, {
    checks: [
      { key: 'reported_symptom', label: 'อาการเดิม', passed: true },
      { key: 'stability_test', label: 'ความเสถียร', passed: false },
    ],
    note: 'เครื่องดับระหว่าง burn-in',
  });

  assert.equal(result.checks[1].passed, false);
  assert.equal(result.note, 'เครื่องดับระหว่าง burn-in');
});
