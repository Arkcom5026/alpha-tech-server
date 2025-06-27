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
} = require('../controllers/employeeController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/',  getAllEmployees);
router.get('/positions', getAllPositions);
router.get('/:id',  getEmployeesById);
router.post('/',  createEmployees);
router.put('/:id',  updateEmployees);
router.delete('/:id',  deleteEmployees);
router.get('/users/by-role',  getUsersByRole);
router.post('/approve-employee', approveEmployee);


module.exports = router;
