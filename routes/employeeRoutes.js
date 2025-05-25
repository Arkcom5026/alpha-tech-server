// ✅ @filename: server/routes/employeeRoutes.js
const express = require('express');
const {
  getAllEmployees,
  getEmployeesById,
  createEmployees,
  updateEmployees,
  deleteEmployees,
  getUsersByRole,
  searchUsers,
} = require('../controllers/employeeController');
const { verifyToken } = require('../middleware/verifyToken');

const router = express.Router();

router.get('/', verifyToken, getAllEmployees);
router.get('/:id', verifyToken, getEmployeesById);
router.post('/', verifyToken, createEmployees);
router.put('/:id', verifyToken, updateEmployees);
router.delete('/:id', verifyToken, deleteEmployees);

router.get('/users/by-role', verifyToken, getUsersByRole);
router.get('/users/search', verifyToken, searchUsers);

module.exports = router;
