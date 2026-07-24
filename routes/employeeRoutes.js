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
  approveEmployee,
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
router.post('/approve-employee', approveEmployee);

router.get('/', getAllEmployees);
router.post('/', createEmployees);
router.get('/:id', getEmployeesById);
router.put('/:id', updateEmployees);
router.patch('/:id/status', toggleEmployeeStatus);

// Kept temporarily as an explicit compatibility response. The controller
// always returns 405 and never removes EmployeeProfile history.
router.delete('/:id', deleteEmployees);

module.exports = router;
