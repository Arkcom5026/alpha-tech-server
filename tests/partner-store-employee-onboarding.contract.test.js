const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const routes = read('src/modules/auth/routes/sessionAuthRoutes.js');
const service = read('src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeService.js');
const repository = read('src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeRepository.js');
const verifyToken = read('middlewares/verifyToken.js');

assert.ok(routes.includes("router.post('/add-sub-employee', verifyToken, addSubEmployee)"));
assert.ok(service.includes('canCreateEmployee'));
assert.ok(service.includes("employeeRole === 'OWNER'"));
assert.ok(service.includes("employeeRole === 'MANAGER'"));
assert.ok(service.includes("code: 'EMPLOYEE_ONBOARDING_FORBIDDEN'"));
assert.ok(service.includes('actor.branchId || actor.employeeProfile?.branchId'));
assert.ok(!service.includes('req.body?.branchId'));
assert.ok(service.includes('password.length < 8'));
assert.ok(service.includes('อย่างน้อย 8 ตัวอักษร'));
assert.ok(service.includes("['MANAGER', 'CASHIER'].includes(v2Role)"));
assert.ok(service.includes("role: 'EMPLOYEE'"));
assert.ok(service.includes('approved: true'));
assert.ok(service.includes('active: true'));
assert.ok(service.includes('enabled: true'));
assert.ok(repository.includes('prisma.$transaction'));
assert.ok(verifyToken.includes('branchId: employeeProfile?.branchId || null'));
assert.ok(verifyToken.includes('employeeRole: employeeProfile?.v2Role || null'));

console.log('partner store employee onboarding contract: PASS');
