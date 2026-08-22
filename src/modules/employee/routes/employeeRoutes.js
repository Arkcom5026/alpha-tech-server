const express = require('express');

const { getAllEmployees } = require('../query/list/listEmployeeController');
const { getEmployeesById } = require('../query/detail/detailEmployeeController');
const { getUsersByRole } = require('../query/usersByRole/usersByRoleController');
const { createEmployeeController } = require('../create/createEmployeeController');
const { updateEmployeeController } = require('../update/updateEmployeeController');
const { toggleEmployeeStatus } = require('../status/statusEmployeeController');
const { updateUserRole } = require('../role/updateEmployeeRoleController');
const { getAllPositions } = require('../lookup/positions/positionLookupController');
const { getBranchDropdowns } = require('../lookup/branches/branchLookupController');
const { deleteEmployee } = require('../delete/deleteEmployeeController');
const { requireEmployeeManage } = require('../authorization/employeeManagementAuthorization');

const verifyToken = require('../../../../middlewares/verifyToken');
const requireAdmin = require('../../../../middlewares/requireAdmin');

const router = express.Router();

router.use(verifyToken);

// Static routes must stay before /:id routes.
router.get('/positions', getAllPositions);
router.get('/branches/dropdowns', requireAdmin.superadmin, getBranchDropdowns);
router.patch('/roles/users/:userId/role', requireAdmin.superadmin, updateUserRole);
router.get('/users/by-role', getUsersByRole);

router.post('/approve-employee', (_req, res) => res.status(410).json({
  code: 'EMPLOYEE_APPROVAL_WORKFLOW_DEPRECATED',
  message: 'ขั้นตอนอนุมัติพนักงานถูกยกเลิก กรุณาเพิ่มพนักงานผ่านหน้าสร้างบัญชีพนักงานโดยตรง',
  canonicalEndpoint: '/api/auth/add-sub-employee',
}));

router.get('/', getAllEmployees);
router.post('/', requireEmployeeManage, createEmployeeController);
router.get('/:id', getEmployeesById);
router.put('/:id', requireEmployeeManage, updateEmployeeController);
router.patch('/:id/status', requireEmployeeManage, toggleEmployeeStatus);
router.delete('/:id', deleteEmployee);

module.exports = router;
