const express = require('express');

const { listEmployees } = require('../query/list/listEmployeeController');
const { getEmployeeDetail } = require('../query/detail/detailEmployeeController');
const { listUsersByRole } = require('../query/usersByRole/usersByRoleController');
const { createEmployee } = require('../create/createEmployeeController');
const { updateEmployee } = require('../update/updateEmployeeController');
const { updateEmployeeStatus } = require('../status/statusEmployeeController');
const { updateEmployeeRole } = require('../role/updateEmployeeRoleController');
const { listPositions } = require('../lookup/positions/positionLookupController');
const { listBranches } = require('../lookup/branches/branchLookupController');
const { deleteEmployee } = require('../delete/deleteEmployeeController');

const verifyToken = require('../../../../middlewares/verifyToken');
const requireAdmin = require('../../../../middlewares/requireAdmin');

const router = express.Router();

router.use(verifyToken);

// Static routes must stay before /:id routes.
router.get('/positions', listPositions);
router.get('/branches/dropdowns', requireAdmin.superadmin, listBranches);
router.patch('/roles/users/:userId/role', requireAdmin.superadmin, updateEmployeeRole);
router.get('/users/by-role', listUsersByRole);

router.post('/approve-employee', (_req, res) => res.status(410).json({
  code: 'EMPLOYEE_APPROVAL_WORKFLOW_DEPRECATED',
  message: 'ขั้นตอนอนุมัติพนักงานถูกยกเลิก กรุณาเพิ่มพนักงานผ่านหน้าสร้างบัญชีพนักงานโดยตรง',
  canonicalEndpoint: '/api/auth/add-sub-employee',
}));

router.get('/', listEmployees);
router.post('/', createEmployee);
router.get('/:id', getEmployeeDetail);
router.put('/:id', updateEmployee);
router.patch('/:id/status', updateEmployeeStatus);
router.delete('/:id', deleteEmployee);

module.exports = router;
