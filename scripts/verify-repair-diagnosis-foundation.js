const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertContains(source, pattern, message) {
  if (!source.includes(pattern)) {
    throw new Error(message);
  }
}

const validator = read('src/modules/repair/validators/repairValidator.js');
const service = read('src/modules/repair/services/repairDiagnosisService.js');
const controller = read('src/modules/repair/controllers/repairController.js');
const routes = read('src/modules/repair/routes/repairRoutes.js');

assertContains(
  validator,
  'REPAIR_DIAGNOSIS_CONCLUSIONS',
  'Diagnosis conclusion contract is missing'
);
assertContains(
  validator,
  'validateRepairDiagnosis',
  'Diagnosis payload validator is missing'
);
assertContains(
  service,
  "['COMPLETED', 'CANCELLED'].includes(job.status)",
  'Terminal repair jobs must reject diagnosis writes'
);
assertContains(
  service,
  'repairDiagnoses: [...history, diagnosis]',
  'Diagnosis history must be appended instead of overwritten'
);
assertContains(
  service,
  'latestRepairDiagnosis: diagnosis',
  'Latest diagnosis projection is missing'
);
assertContains(
  service,
  'diagnosedByEmployeeId: actor.employeeId',
  'Diagnosis actor evidence is missing'
);
assertContains(
  service,
  'diagnosedAt',
  'Diagnosis timestamp evidence is missing'
);
assertContains(
  controller,
  'repairDiagnosisService.record',
  'Diagnosis write controller wiring is missing'
);
assertContains(
  controller,
  'repairDiagnosisService.listForRepairJob',
  'Diagnosis read controller wiring is missing'
);
assertContains(
  routes,
  "'/jobs/:id/diagnoses'",
  'Diagnosis routes are missing'
);
assertContains(
  routes,
  'repairController.recordDiagnosis',
  'Diagnosis write route is missing'
);
assertContains(
  routes,
  'repairController.listDiagnoses',
  'Diagnosis read route is missing'
);

console.log('Repair Diagnosis Foundation: PASS');
