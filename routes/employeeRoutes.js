// ✅ @filename: server/routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllEmployees,
  getEmployeesById,
  createEmployees,
  updateEmployees,
  deleteEmployees,
  getUsersByRole,
  getAllPositions,
  updateUserRole,
  getBranchDropdowns,
  toggleEmployeeStatus,
} = require('../controllers/employeeController');

const verifyToken = require('../middlewares/verifyToken');
const requireAdmin = require('../middlewares/requireAdmin');

router.use(verifyToken);

// Static routes must stay before /:id routes.
router.get('/positions', getAllPositions);
router.get('/branches/dropdowns', requireAdmin.superadmin, getBranchDropdowns);
router.patch('/roles/users/:userId/role', requireAdmin.superadmin, updateUserRole);
router.get('/users/by-role', getUsersByRole);

// Employee approval workflow is deprecated.
// Partner-created employees are created active and approved in one atomic flow.
router.post('/approve-employee', (_req, res) => res.status(410).json({
  code: 'EMPLOYEE_APPROVAL_WORKFLOW_DEPRECATED',
  message: 'ขั้นตอนอนุมัติพนักงานถูกยกเลิก กรุณาเพิ่มพนักงานผ่านหน้าสร้างบัญชีพนักงานโดยตรง',
  canonicalEndpoint: '/api/auth/add-sub-employee',
}));

router.get('/', getAllEmployees);
router.post('/', createEmployees);
router.get('/:id', getEmployeesById);
router.put('/:id', updateEmployees);
router.patch('/:id/status', toggleEmployeeStatus);

// Kept temporarily as an explicit compatibility response. The controller
// always returns 405 and never removes EmployeeProfile history.
router.delete('/:id', deleteEmployees);

module.exports = router;
